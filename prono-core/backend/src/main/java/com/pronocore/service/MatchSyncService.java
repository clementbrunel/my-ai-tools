package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.client.ApiFootballClient.ApiFixture;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
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
 * Reads the fixture ID from match_external_links.api_football_fixture_id.
 * Home/away mapping uses ISO2-derived team IDs via TeamMappingService.
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
            MatchExternalLinks links = match.getExternalLinks();
            if (links == null || links.getApiFootballFixtureId() == null) continue;
            processMatch(match, links.getApiFootballFixtureId());
        }
    }

    private void processMatch(Match match, long fixtureId) {
        ApiFixture fixture = apiClient.getFixture(fixtureId);
        if (fixture == null) return;

        String status = fixture.statusShort();

        if (ApiFootballClient.LIVE_STATUSES.contains(status)
                && match.getStatus() == Match.Status.UPCOMING) {
            log.info("Match {} ({} vs {}) is now ONGOING", match.getId(), match.getTeamA().getName(), match.getTeamB().getName());
            matchService.syncMatchScore(match.getId(), 0, 0, Match.Status.ONGOING);
            return;
        }

        if (ApiFootballClient.FINISHED_STATUSES.contains(status)
                && match.getStatus() != Match.Status.FINISHED) {
            if (fixture.homeGoals() == null || fixture.awayGoals() == null) return;

            int[] scores = mapGoals(match, fixture);
            log.info("Auto-settling match {} ({} {}-{} {})",
                    match.getId(), match.getTeamA().getName(), scores[0], scores[1], match.getTeamB().getName());
            matchService.syncMatchScore(match.getId(), scores[0], scores[1], Match.Status.FINISHED);
        }
    }

    private int[] mapGoals(Match match, ApiFixture fixture) {
        Optional<Long> idA = teamMapping.getTeamId(match.getTeamA().getName());
        if (idA.isPresent() && idA.get() == fixture.homeTeamId()) {
            return new int[]{fixture.homeGoals(), fixture.awayGoals()};
        }
        Optional<Long> idB = teamMapping.getTeamId(match.getTeamB().getName());
        if (idB.isPresent() && idB.get() == fixture.homeTeamId()) {
            return new int[]{fixture.awayGoals(), fixture.homeGoals()};
        }
        log.warn("Match {}: home/away undetermined via team IDs, assuming teamA=home", match.getId());
        return new int[]{fixture.homeGoals(), fixture.awayGoals()};
    }
}
