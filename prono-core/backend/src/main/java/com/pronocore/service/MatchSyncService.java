package com.pronocore.service;

import com.pronocore.client.FootballDataClient;
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
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchSyncService {

    private final MatchRepository    matchRepository;
    private final MatchService       matchService;
    private final FootballDataClient footballDataClient;

    /**
     * Guards against the scheduled poll and an admin-triggered sync running at once:
     * two passes over the same match could each see it as unfinished and settle its
     * bets twice.
     */
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** Poll every 5 minutes. Syncs matches that kicked off in the last 3h or start in the next 15min. */
    @Scheduled(fixedDelay = 300_000)
    public void syncMatches() {
        if (!running.compareAndSet(false, true)) {
            log.debug("MatchSyncService: a sync is already in progress — skipping this pass");
            return;
        }
        try {
            doSync();
        } finally {
            running.set(false);
        }
    }

    private void doSync() {
        if (footballDataClient.isDisabled()) return;

        LocalDateTime now  = LocalDateTime.now();
        LocalDateTime from = now.minusHours(3);
        LocalDateTime to   = now.plusMinutes(15);
        List<Match> candidates = matchRepository.findSyncableMatchesInWindow(from, to);
        if (candidates.isEmpty()) return;

        // football-data.org has no "fetch by ids" endpoint, so matches are refetched per
        // competition within the sync window and matched back locally by footballDataMatchId.
        Map<Long, Match> matchesByFdId = new LinkedHashMap<>();
        for (Match match : candidates) {
            MatchExternalLinks links = match.getExternalLinks();
            if (links != null && links.getFootballDataMatchId() != null) {
                matchesByFdId.put(links.getFootballDataMatchId(), match);
            }
        }
        if (matchesByFdId.isEmpty()) return;

        List<String> competitionCodes = matchesByFdId.values().stream()
                .map(m -> m.getCompetition().getFootballDataCompetitionCode())
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        log.info("MatchSyncService: {} match(es) to sync ({})", matchesByFdId.size(), competitionCodes);

        for (String code : competitionCodes) {
            List<FootballDataClient.FdMatch> fixtures;
            try {
                fixtures = footballDataClient.getMatchesInWindow(code, from.toLocalDate(), to.toLocalDate());
            } catch (Exception e) {
                log.warn("MatchSyncService: football-data.org fetch failed for {} — {}", code, e.getMessage());
                continue;
            }

            for (FootballDataClient.FdMatch fixture : fixtures) {
                Match match = matchesByFdId.get(fixture.id());
                if (match == null) continue;
                try {
                    Match.Status newStatus = toStatus(fixture.status());
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
    }

    private Match.Status toStatus(String status) {
        if (FootballDataClient.FINISHED_STATUSES.contains(status)) return Match.Status.FINISHED;
        if (FootballDataClient.LIVE_STATUSES.contains(status))     return Match.Status.ONGOING;
        return null;
    }
}
