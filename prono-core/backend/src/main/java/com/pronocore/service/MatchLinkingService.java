package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.repository.MatchExternalLinksRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchLinkingService {

    private static final double AUTO_LINK_THRESHOLD = 0.85;

    private final MatchService                matchService;
    private final ApiFootballClient           apiFootballClient;
    private final TeamMappingService          teamMappingService;
    private final MatchExternalLinksRepository linksRepository;

    @Transactional(readOnly = true)
    public List<FixtureCandidateResponse> findCandidates(Long matchId) {
        Match match = matchService.findById(matchId);
        List<ApiFootballClient.ApiFixture> fixtures = apiFootballClient.getAllFixtures();

        Long teamAId = teamMappingService.getTeamId(match.getTeamA().getName());
        Long teamBId = teamMappingService.getTeamId(match.getTeamB().getName());

        return fixtures.stream()
                .map(f -> score(f, match, teamAId, teamBId))
                .sorted(Comparator.comparingDouble(FixtureCandidateResponse::getConfidence).reversed())
                .limit(10)
                .filter(r -> r.getConfidence() > 0.1)
                .toList();
    }

    @Transactional
    public void linkMatch(Long matchId, Long externalId, String apiCode) {
        Match match = matchService.findById(matchId);
        MatchExternalLinks links = linksRepository.findById(matchId)
                .orElse(MatchExternalLinks.builder().match(match).build());
        if ("API-FOOTBALL".equals(apiCode)) {
            links.setApiFootballFixtureId(externalId);
        }
        linksRepository.save(links);
        log.info("Linked match {} to {} fixture {}", matchId, apiCode, externalId);
    }

    @Transactional
    public void unlinkMatch(Long matchId, String apiCode) {
        linksRepository.findById(matchId).ifPresent(links -> {
            if ("API-FOOTBALL".equals(apiCode)) {
                links.setApiFootballFixtureId(null);
            }
            if (links.toMap().isEmpty()) {
                linksRepository.delete(links);
            } else {
                linksRepository.save(links);
            }
            log.info("Unlinked match {} from {}", matchId, apiCode);
        });
    }

    private FixtureCandidateResponse score(ApiFootballClient.ApiFixture fixture,
                                            Match match,
                                            Long teamAId, Long teamBId) {
        double teamScore = 0.0;
        if (teamAId != null && teamBId != null) {
            boolean homeA = fixture.homeTeamId() == teamAId && fixture.awayTeamId() == teamBId;
            boolean homeB = fixture.homeTeamId() == teamBId && fixture.awayTeamId() == teamAId;
            if (homeA || homeB) teamScore = 0.6;
        }

        double dateScore = 0.0;
        if (fixture.date() != null) {
            long hours = Math.abs(Duration.between(match.getMatchDate(), fixture.date()).toHours());
            if (hours <= 2)  dateScore = 0.4;
            else if (hours <= 24) dateScore = 0.2;
            else if (hours <= 72) dateScore = 0.05;
        }

        double confidence = teamScore + dateScore;
        return FixtureCandidateResponse.builder()
                .fixtureId(fixture.fixtureId())
                .homeTeam(fixture.homeTeamName())
                .awayTeam(fixture.awayTeamName())
                .date(fixture.date())
                .confidence(confidence)
                .autoLinkable(confidence >= AUTO_LINK_THRESHOLD)
                .build();
    }
}
