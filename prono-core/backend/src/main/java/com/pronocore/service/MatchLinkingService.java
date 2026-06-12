package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.client.ApiFootballClient.ApiFixture;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.entity.Match;
import com.pronocore.repository.MatchRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

/**
 * Handles linking our Match records to api-football.com fixture IDs.
 *
 * Confidence scoring (0.0 – 1.0):
 *   - Date proximity (40 %): ≤10 min → 0.40, ≤60 min → 0.30, ≤120 min → 0.15
 *   - Team name match (60 %): both teams match → 0.60, one team → 0.30
 *
 * Auto-linkable threshold: 0.85 (date close + both teams matched).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchLinkingService {

    private static final double THRESHOLD_AUTO = 0.85;
    private static final int    MAX_CANDIDATES = 5;

    private final ApiFootballClient  apiClient;
    private final MatchRepository    matchRepository;
    private final TeamNameNormalizer normalizer;

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

    @Transactional
    public void linkMatch(Long matchId, Long fixtureId) {
        Match match = requireMatch(matchId);
        match.setExternalFixtureId(fixtureId);
        matchRepository.save(match);
        log.info("Match {} linked to fixture {}", matchId, fixtureId);
        // Invalidate cache so the new link is reflected immediately in sync
        apiClient.invalidateCache();
    }

    @Transactional
    public void unlinkMatch(Long matchId) {
        Match match = requireMatch(matchId);
        match.setExternalFixtureId(null);
        matchRepository.save(match);
        log.info("Match {} unlinked", matchId);
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    private FixtureCandidateResponse score(Match match, ApiFixture fixture) {
        double score = 0.0;

        // --- Date proximity (40 %) ---
        long diffMinutes = Math.abs(ChronoUnit.MINUTES.between(
                match.getMatchDate().atOffset(java.time.ZoneOffset.UTC),
                fixture.date()));
        if (diffMinutes <= 10)       score += 0.40;
        else if (diffMinutes <= 60)  score += 0.30;
        else if (diffMinutes <= 120) score += 0.15;
        // Beyond 120 min: 0 contribution from date

        // --- Team name matching (60 %) ---
        double simAHome = normalizer.similarity(match.getTeamA(), fixture.homeTeam());
        double simBAway = normalizer.similarity(match.getTeamB(), fixture.awayTeam());
        double simAway  = normalizer.similarity(match.getTeamA(), fixture.awayTeam());
        double simBHome = normalizer.similarity(match.getTeamB(), fixture.homeTeam());

        double directScore  = (simAHome + simBAway) / 2.0;
        double reverseScore = (simAway  + simBHome) / 2.0;
        double bestTeamScore = Math.max(directScore, reverseScore);

        score += bestTeamScore * 0.60;

        return FixtureCandidateResponse.builder()
                .fixtureId(fixture.fixtureId())
                .homeTeam(fixture.homeTeam())
                .awayTeam(fixture.awayTeam())
                .date(fixture.date())
                .confidence(Math.min(score, 1.0))
                .autoLinkable(score >= THRESHOLD_AUTO)
                .build();
    }

    private Match requireMatch(Long id) {
        return matchRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
    }
}
