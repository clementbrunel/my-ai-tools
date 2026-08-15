package com.pronocore.service;

import com.pronocore.client.FootballDataClient;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.entity.Team;
import com.pronocore.repository.MatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchSyncServiceTest {

    @Mock private MatchRepository    matchRepository;
    @Mock private MatchService       matchService;
    @Mock private FootballDataClient footballDataClient;

    @InjectMocks
    private MatchSyncService matchSyncService;

    private static final Competition LIGUE_1 = Competition.builder()
            .id(2L).name("Ligue 1 2026-2027").footballDataCompetitionCode("FL1").build();

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private Match linkedMatch(long matchId, long fdMatchId) {
        Match match = Match.builder()
                .id(matchId)
                .teamA(Team.builder().name("PSG").build())
                .teamB(Team.builder().name("OM").build())
                .matchDate(LocalDateTime.of(2026, 8, 20, 21, 0))
                .competition(LIGUE_1)
                .build();
        match.setExternalLinks(MatchExternalLinks.builder()
                .matchId(matchId).match(match).footballDataMatchId(fdMatchId).build());
        return match;
    }

    private FootballDataClient.FdMatch fixture(long id, String status, Integer home, Integer away) {
        return new FootballDataClient.FdMatch(
                id, LocalDateTime.of(2026, 8, 20, 21, 0),
                "PSG", "OM", 1L, 2L, status, home, away, 1);
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    @Test
    void fetchesMatchesPerCompetitionCode() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 201L)));
        when(footballDataClient.getMatchesInWindow(eq("FL1"), any(), any())).thenReturn(List.of());

        matchSyncService.syncMatches();

        verify(footballDataClient, times(1)).getMatchesInWindow(eq("FL1"), any(), any());
    }

    @Test
    void doesNothingWhenApiKeyIsMissing() {
        when(footballDataClient.isDisabled()).thenReturn(true);

        matchSyncService.syncMatches();

        verifyNoInteractions(matchRepository);
        verify(footballDataClient, never()).getMatchesInWindow(any(), any(), any());
    }

    @Test
    void skipsMatchesWithoutAnExternalLink() {
        Match unlinked = Match.builder().id(9L).build();
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any())).thenReturn(List.of(unlinked));

        matchSyncService.syncMatches();

        verify(footballDataClient, never()).getMatchesInWindow(any(), any(), any());
    }

    // ── Score propagation ─────────────────────────────────────────────────────

    @Test
    void pushesFinishedScoreToMatchService() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 201L)));
        when(footballDataClient.getMatchesInWindow(eq("FL1"), any(), any()))
                .thenReturn(List.of(fixture(201L, "FINISHED", 2, 1)));

        matchSyncService.syncMatches();

        verify(matchService).syncMatchScore(1L, 2, 1, Match.Status.FINISHED);
    }

    @Test
    void treatsInPlayStatusAsOngoing() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 201L)));
        when(footballDataClient.getMatchesInWindow(eq("FL1"), any(), any()))
                .thenReturn(List.of(fixture(201L, "IN_PLAY", 0, 0)));

        matchSyncService.syncMatches();

        verify(matchService).syncMatchScore(1L, 0, 0, Match.Status.ONGOING);
    }

    @Test
    void ignoresFixturesInAnUnmappedStatus() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 201L)));
        when(footballDataClient.getMatchesInWindow(eq("FL1"), any(), any()))
                .thenReturn(List.of(fixture(201L, "SCHEDULED", null, null)));

        matchSyncService.syncMatches();

        verify(matchService, never()).syncMatchScore(anyLong(), anyInt(), anyInt(), any());
    }

    /** A manual admin trigger must not overlap the scheduled poll and settle bets twice. */
    @Test
    void skipsAPassWhileAnotherSyncIsAlreadyRunning() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any())).thenAnswer(invocation -> {
            matchSyncService.syncMatches(); // re-entered while the first pass holds the guard
            return List.of();
        });

        matchSyncService.syncMatches();

        verify(matchRepository, times(1)).findSyncableMatchesInWindow(any(), any());
    }

    @Test
    void releasesTheGuardAfterAFailedPass() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenThrow(new IllegalStateException("boom"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> matchSyncService.syncMatches()).isInstanceOf(IllegalStateException.class);
        assertThatCode(() -> matchSyncService.syncMatches()).doesNotThrowAnyException();

        verify(matchRepository, times(2)).findSyncableMatchesInWindow(any(), any());
    }

    @Test
    void keepsSyncingOtherCompetitionsWhenOneFetchFails() {
        when(footballDataClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 201L)));
        when(footballDataClient.getMatchesInWindow(eq("FL1"), any(), any()))
                .thenThrow(new IllegalStateException("football-data.org HTTP 429"));

        assertThatCode(() -> matchSyncService.syncMatches()).doesNotThrowAnyException();
        verify(matchService, never()).syncMatchScore(anyLong(), anyInt(), anyInt(), any());
    }
}
