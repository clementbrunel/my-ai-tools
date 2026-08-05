package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchSyncService {

    private final MatchRepository    matchRepository;
    private final MatchService       matchService;
    private final ApiFootballClient  apiFootballClient;

    /** Poll every 5 minutes. Syncs matches that kicked off in the last 3h or start in the next 15min. */
    @Scheduled(fixedDelay = 300_000)
    public void syncMatches() {
        if (apiFootballClient.isDisabled()) return;

        LocalDateTime now = LocalDateTime.now();
        List<Match> candidates = matchRepository.findSyncableMatchesInWindow(
                now.minusHours(3), now.plusMinutes(15));

        if (candidates.isEmpty()) return;

        // Resolve every linked fixture in one batched call rather than one call per
        // match: at a 5-minute cadence, per-match calls exhaust the daily quota.
        Map<Long, Match> matchesByFixtureId = new LinkedHashMap<>();
        for (Match match : candidates) {
            MatchExternalLinks links = match.getExternalLinks();
            if (links != null && links.getApiFootballFixtureId() != null) {
                matchesByFixtureId.put(links.getApiFootballFixtureId(), match);
            }
        }
        if (matchesByFixtureId.isEmpty()) return;
        log.info("MatchSyncService: {} match(es) to sync", matchesByFixtureId.size());

        List<ApiFootballClient.ApiFixture> fixtures;
        try {
            fixtures = apiFootballClient.getFixtures(matchesByFixtureId.keySet());
        } catch (Exception e) {
            log.warn("MatchSyncService: fixture fetch failed — {}", e.getMessage());
            return;
        }

        for (ApiFootballClient.ApiFixture fixture : fixtures) {
            Match match = matchesByFixtureId.get(fixture.fixtureId());
            if (match == null) continue;
            try {
                Match.Status newStatus = toStatus(fixture.statusShort());
                if (newStatus == null) continue;

                matchService.syncMatchScore(match.getId(),
                        fixture.goalsHome() != null ? fixture.goalsHome() : 0,
                        fixture.goalsAway() != null ? fixture.goalsAway() : 0,
                        newStatus);

                log.info("  ✓ Match {} ({} vs {}) synced → {} ({}-{})",
                        match.getId(),
                        match.getTeamA().getName(),
                        match.getTeamB().getName(),
                        newStatus,
                        fixture.goalsHome(),
                        fixture.goalsAway());
            } catch (Exception e) {
                log.warn("  ✗ Failed to sync match {}: {}", match.getId(), e.getMessage());
            }
        }
    }

    private Match.Status toStatus(String short_) {
        if (ApiFootballClient.FINISHED_STATUSES.contains(short_)) return Match.Status.FINISHED;
        if (ApiFootballClient.LIVE_STATUSES.contains(short_))     return Match.Status.ONGOING;
        return null;
    }
}
