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

/**
 * Polls api-football.com every 5 minutes for matches that are inside their
 * "active window" (kick-off − 15 min to kick-off + 3 h).
 *
 * Only processes matches that:
 *   1. Have an external_fixture_id set (i.e. have been linked)
 *   2. Are NOT sync-locked (admin override takes precedence)
 *   3. Are not already FINISHED in our DB
 *
 * Uses MatchService.syncMatchScore() which handles bet settlement and daily-gage
 * assignment exactly like the admin endpoint does.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchSyncService {

    private final MatchRepository    matchRepository;
    private final MatchService       matchService;
    private final ApiFootballClient  apiClient;
    private final TeamNameNormalizer normalizer;

    @Value("${sync.enabled:true}")
    private boolean syncEnabled;

    @Scheduled(fixedDelay = 300_000)   // every 5 minutes
    public void syncMatches() {
        if (!syncEnabled || apiClient.isDisabled()) return;

        LocalDateTime now         = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime windowStart = now.minusHours(3);
        LocalDateTime windowEnd   = now.plusMinutes(15);

        List<Match> candidates = matchRepository.findSyncableMatchesInWindow(windowStart, windowEnd);
        if (candidates.isEmpty()) return;

        log.debug("Sync: {} match(es) in active window", candidates.size());

        for (Match match : candidates) {
            if (match.getExternalFixtureId() == null) continue;
            processMatch(match);
        }
    }

    private void processMatch(Match match) {
        ApiFixture fixture = apiClient.getFixture(match.getExternalFixtureId());
        if (fixture == null) return;

        String status = fixture.statusShort();

        // Mark ONGOING when the match kicks off
        if (ApiFootballClient.LIVE_STATUSES.contains(status)
                && match.getStatus() == Match.Status.UPCOMING) {
            log.info("Match {} ({} vs {}) is now ONGOING", match.getId(), match.getTeamA(), match.getTeamB());
            matchService.syncMatchScore(match.getId(), 0, 0, Match.Status.ONGOING);
            return;
        }

        // Settle when finished
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
     * Determines which API goal (home vs away) corresponds to teamA vs teamB.
     * Uses the TeamNameNormalizer to compare our team names with the fixture's team names.
     * Returns [scoreA, scoreB].
     */
    private int[] mapGoals(Match match, ApiFixture fixture) {
        double simAHome = normalizer.similarity(match.getTeamA(), fixture.homeTeam());
        double simBHome = normalizer.similarity(match.getTeamB(), fixture.homeTeam());

        // If teamA better matches the home team → home=teamA, away=teamB
        if (simAHome >= simBHome) {
            return new int[]{fixture.homeGoals(), fixture.awayGoals()};
        } else {
            return new int[]{fixture.awayGoals(), fixture.homeGoals()};
        }
    }
}
