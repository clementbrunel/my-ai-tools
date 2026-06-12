package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.client.ApiFootballClient.ApiFixture;
import com.pronocore.entity.Match;
import com.pronocore.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

/**
 * Polls api-football.com every 5 minutes for matches inside their active window
 * (kick-off − 15 min → kick-off + 3 h).
 *
 * Home/away mapping uses ISO2-derived team IDs from TeamMappingService —
 * no text translation required regardless of the language used in our DB.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchSyncService {

    private final MatchRepository    matchRepository;
    private final MatchService       matchService;
    private final ApiFootballClient  apiClient;
    private final TeamMappingService teamMapping;

    @Value("${sync.enabled:true}")
    private boolean syncEnabled;

    @Scheduled(fixedDelay = 300_000)
    public void syncMatches() {
        if (!syncEnabled || apiClient.isDisabled()) return;

        LocalDateTime now   = LocalDateTime.now(ZoneOffset.UTC);
        List<Match> targets = matchRepository.findSyncableMatchesInWindow(
                now.minusHours(3), now.plusMinutes(15));
        if (targets.isEmpty()) return;

        log.debug("Sync: {} match(es) in active window", targets.size());
        for (Match match : targets) {
            if (match.getExternalFixtureId() == null) continue;
            processMatch(match);
        }
    }

    private void processMatch(Match match) {
        ApiFixture fixture = apiClient.getFixture(match.getExternalFixtureId());
        if (fixture == null) return;

        String status = fixture.statusShort();

        if (ApiFootballClient.LIVE_STATUSES.contains(status)
                && match.getStatus() == Match.Status.UPCOMING) {
            log.info("Match {} ({} vs {}) is now ONGOING", match.getId(), match.getTeamA(), match.getTeamB());
            matchService.syncMatchScore(match.getId(), 0, 0, Match.Status.ONGOING);
            return;
        }

        if (ApiFootballClient.FINISHED_STATUSES.contains(status)
                && match.getStatus() != Match.Status.FINISHED) {
            if (fixture.homeGoals() == null || fixture.awayGoals() == null) return;

            int[] scores = mapGoals(match, fixture);
            log.info("Auto-settling match {} ({} {}-{} {})",
                    match.getId(), match.getTeamA(), scores[0], scores[1], match.getTeamB());
            matchService.syncMatchScore(match.getId(), scores[0], scores[1], Match.Status.FINISHED);
        }
    }

    /**
     * Maps fixture home/away goals to our teamA/teamB order using ISO2-derived team IDs.
     * Falls back to assuming teamA = home if no ID is available.
     */
    private int[] mapGoals(Match match, ApiFixture fixture) {
        Optional<Long> idA = teamMapping.getTeamId(match.getTeamA());
        if (idA.isPresent() && idA.get() == fixture.homeTeamId()) {
            return new int[]{fixture.homeGoals(), fixture.awayGoals()};
        }
        Optional<Long> idB = teamMapping.getTeamId(match.getTeamB());
        if (idB.isPresent() && idB.get() == fixture.homeTeamId()) {
            return new int[]{fixture.awayGoals(), fixture.homeGoals()};
        }
        log.warn("Match {}: could not determine home/away via team IDs, assuming teamA=home", match.getId());
        return new int[]{fixture.homeGoals(), fixture.awayGoals()};
    }
}
