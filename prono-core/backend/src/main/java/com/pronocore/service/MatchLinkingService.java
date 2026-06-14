package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.client.ApiFootballClient.ApiFixture;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.repository.MatchExternalLinksRepository;
import com.pronocore.repository.MatchRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Handles linking Match records to external API fixture IDs.
 *
 * Confidence scoring (0.0 – 1.0):
 *   - Date proximity  (40 %): ≤10 min → 0.40, ≤60 min → 0.30, ≤120 min → 0.15
 *   - Team ID match   (60 %): both teams via ISO2→ID → 0.60, one team → 0.30
 *                             name-containment fallback when ISO2 unknown → ≤0.20
 *
 * Auto-linkable threshold: 0.85.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchLinkingService {

    private static final double THRESHOLD_AUTO  = 0.85;
    private static final int    MAX_CANDIDATES  = 5;
    private static final String API_FOOTBALL    = "API-FOOTBALL";

    private final ApiFootballClient          apiClient;
    private final MatchRepository            matchRepository;
    private final MatchExternalLinksRepository linksRepository;
    private final TeamMappingService         teamMapping;

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<FixtureCandidateResponse> findCandidates(Long matchId) {
        Match match = requireMatch(matchId);
        List<ApiFixture> fixtures = apiClient.getAllFixtures();

        return fixtures.stream()
                .map(f -> score(match, f))
                .filter(c -> c.getConfidence() > 0.20)
                .sorted(Comparator.comparingDouble(FixtureCandidateResponse::getConfidence).reversed())
                .limit(MAX_CANDIDATES)
                .toList();
    }

    /**
     * Links a match to an external fixture ID for the given API code.
     * Currently supports API-FOOTBALL. Adding a new API = add a branch here
     * after creating the corresponding column via Flyway migration.
     */
    @Transactional
    public void linkMatch(Long matchId, Long externalId, String apiCode) {
        Match match = requireMatch(matchId);

        MatchExternalLinks links = match.getExternalLinks();
        if (links == null) {
            links = new MatchExternalLinks();
            links.setMatch(match);
            match.setExternalLinks(links);
        }

        switch (apiCode.toUpperCase()) {
            case API_FOOTBALL -> links.setApiFootballFixtureId(externalId);
            default -> throw new IllegalArgumentException("Unknown API code: " + apiCode);
        }

        linksRepository.save(links);
        log.info("Match {} linked to {} external ID {}", matchId, apiCode, externalId);
        apiClient.invalidateCache();
    }

    /**
     * Removes the external link for a specific API from a match.
     * If all links are null after the removal, the row is deleted.
     */
    @Transactional
    public void unlinkMatch(Long matchId, String apiCode) {
        Match match = requireMatch(matchId);
        MatchExternalLinks links = match.getExternalLinks();
        if (links == null) return;

        switch (apiCode.toUpperCase()) {
            case API_FOOTBALL -> links.setApiFootballFixtureId(null);
            default -> throw new IllegalArgumentException("Unknown API code: " + apiCode);
        }

        if (links.toMap().isEmpty()) {
            linksRepository.delete(links);
            match.setExternalLinks(null);
        } else {
            linksRepository.save(links);
        }
        log.info("Match {} unlinked from {}", matchId, apiCode);
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    private FixtureCandidateResponse score(Match match, ApiFixture fixture) {
        double score = 0.0;

        // --- Date proximity (40 %) ---
        long diffMinutes = Math.abs(ChronoUnit.MINUTES.between(
                match.getMatchDate().atOffset(ZoneOffset.UTC),
                fixture.date()));
        if (diffMinutes <= 10)       score += 0.40;
        else if (diffMinutes <= 60)  score += 0.30;
        else if (diffMinutes <= 120) score += 0.15;

        // --- Team matching (60 %) via ISO2 → team ID ---
        Optional<Long> idA = teamMapping.getTeamId(match.getTeamA());
        Optional<Long> idB = teamMapping.getTeamId(match.getTeamB());

        if (idA.isPresent() && idB.isPresent()) {
            boolean direct  = idA.get() == fixture.homeTeamId() && idB.get() == fixture.awayTeamId();
            boolean reverse = idB.get() == fixture.homeTeamId() && idA.get() == fixture.awayTeamId();
            if (direct || reverse) {
                score += 0.60;
            } else if (idA.get() == fixture.homeTeamId() || idA.get() == fixture.awayTeamId()
                    || idB.get() == fixture.homeTeamId() || idB.get() == fixture.awayTeamId()) {
                score += 0.30;
            }
        } else {
            score += fallbackNameScore(match, fixture) * 0.20;
        }

        return FixtureCandidateResponse.builder()
                .fixtureId(fixture.fixtureId())
                .homeTeam(fixture.homeTeam())
                .awayTeam(fixture.awayTeam())
                .date(fixture.date())
                .confidence(Math.min(score, 1.0))
                .autoLinkable(score >= THRESHOLD_AUTO)
                .build();
    }

    private double fallbackNameScore(Match match, ApiFixture fixture) {
        String homeL = fixture.homeTeam().toLowerCase();
        String awayL = fixture.awayTeam().toLowerCase();
        String aL    = match.getTeamA().toLowerCase();
        String bL    = match.getTeamB().toLowerCase();
        int hits = 0;
        if (homeL.contains(aL) || aL.contains(homeL)) hits++;
        if (awayL.contains(bL) || bL.contains(awayL)) hits++;
        if (homeL.contains(bL) || bL.contains(homeL)) hits++;
        if (awayL.contains(aL) || aL.contains(awayL)) hits++;
        return hits >= 2 ? 1.0 : hits > 0 ? 0.5 : 0.0;
    }

    private Match requireMatch(Long id) {
        return matchRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
    }
}
