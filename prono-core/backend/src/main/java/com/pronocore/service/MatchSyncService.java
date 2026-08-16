package com.pronocore.service;

import com.pronocore.client.FootballDataClient;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

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
            if (footballDataClient.isDisabled()) return;
            LocalDateTime now  = LocalDateTime.now();
            LocalDateTime from = now.minusHours(3);
            LocalDateTime to   = now.plusMinutes(15);
            doSync(matchRepository.findSyncableMatchesInWindow(from, to), from.toLocalDate(), to.toLocalDate());
        } finally {
            running.set(false);
        }
    }

    /**
     * Admin-triggered manual sync ("🔄 Sync API" button in the matches tab). Unlike the
     * scheduled poll above — which only looks at matches currently live or about to start, to
     * stay within football-data.org's free-tier rate limit — an admin clicking this button
     * expects every outstanding match to be refreshed, not just ones in that narrow window.
     * Uses the cached season-wide fixture list per competition instead of a date-windowed call.
     */
    public void triggerManualSync() {
        if (!running.compareAndSet(false, true)) {
            log.debug("MatchSyncService: a sync is already in progress — skipping manual trigger");
            return;
        }
        try {
            if (footballDataClient.isDisabled()) return;
            doManualSync(matchRepository.findSyncableMatches());
        } finally {
            running.set(false);
        }
    }

    // football-data.org has /v4/matches/{id} but no batch "fetch several by ids" endpoint
    // (only single-match lookups), so matches are refetched per competition in one call and
    // matched back locally by footballDataMatchId — cheaper than one HTTP call per linked
    // match under the free tier's 10 requests/minute cap.

    private void doSync(List<Match> candidates, LocalDate from, LocalDate to) {
        Map<Long, Match> matchesByFdId = indexByFootballDataId(candidates);
        if (matchesByFdId.isEmpty()) return;

        List<String> competitionCodes = distinctCodes(matchesByFdId.values());
        log.info("MatchSyncService: {} match(es) to sync ({})", matchesByFdId.size(), competitionCodes);

        for (String code : competitionCodes) {
            List<FootballDataClient.FdMatch> fixtures;
            try {
                fixtures = footballDataClient.getMatchesInWindow(code, from, to);
            } catch (Exception e) {
                log.warn("MatchSyncService: football-data.org fetch failed for {} — {}", code, e.getMessage());
                continue;
            }
            applyFixtures(fixtures, matchesByFdId);
        }
    }

    private void doManualSync(List<Match> candidates) {
        Map<Long, Match> matchesByFdId = indexByFootballDataId(candidates);
        if (matchesByFdId.isEmpty()) return;

        Map<String, Integer> seasonByCode = matchesByFdId.values().stream()
                .filter(m -> m.getCompetition().getFootballDataCompetitionCode() != null
                        && m.getCompetition().getSeason() != null)
                .collect(Collectors.toMap(
                        m -> m.getCompetition().getFootballDataCompetitionCode(),
                        m -> m.getCompetition().getSeason(),
                        (a, b) -> a));
        log.info("MatchSyncService: manual sync — {} match(es) to check ({})", matchesByFdId.size(), seasonByCode.keySet());

        for (Map.Entry<String, Integer> entry : seasonByCode.entrySet()) {
            List<FootballDataClient.FdMatch> fixtures;
            try {
                fixtures = footballDataClient.getSeasonMatches(entry.getKey(), entry.getValue());
            } catch (Exception e) {
                log.warn("MatchSyncService: football-data.org fetch failed for {} — {}", entry.getKey(), e.getMessage());
                continue;
            }
            applyFixtures(fixtures, matchesByFdId);
        }
    }

    private static Map<Long, Match> indexByFootballDataId(List<Match> candidates) {
        Map<Long, Match> matchesByFdId = new LinkedHashMap<>();
        for (Match match : candidates) {
            MatchExternalLinks links = match.getExternalLinks();
            if (links != null && links.getFootballDataMatchId() != null) {
                matchesByFdId.put(links.getFootballDataMatchId(), match);
            }
        }
        return matchesByFdId;
    }

    private static List<String> distinctCodes(Collection<Match> matches) {
        return matches.stream()
                .map(m -> m.getCompetition().getFootballDataCompetitionCode())
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private void applyFixtures(List<FootballDataClient.FdMatch> fixtures, Map<Long, Match> matchesByFdId) {
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

    private Match.Status toStatus(String status) {
        if (FootballDataClient.FINISHED_STATUSES.contains(status)) return Match.Status.FINISHED;
        if (FootballDataClient.LIVE_STATUSES.contains(status))     return Match.Status.ONGOING;
        return null;
    }
}
