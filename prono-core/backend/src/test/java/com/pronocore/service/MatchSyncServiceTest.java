package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.entity.Team;
import com.pronocore.repository.MatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchSyncServiceTest {

    @Mock private MatchRepository   matchRepository;
    @Mock private MatchService      matchService;
    @Mock private ApiFootballClient apiFootballClient;

    @InjectMocks
    private MatchSyncService matchSyncService;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private Match linkedMatch(long matchId, long fixtureId) {
        Match match = Match.builder()
                .id(matchId)
                .teamA(Team.builder().name("France").build())
                .teamB(Team.builder().name("Brésil").build())
                .matchDate(LocalDateTime.of(2026, 6, 11, 21, 0))
                .build();
        match.setExternalLinks(MatchExternalLinks.builder()
                .matchId(matchId).match(match).apiFootballFixtureId(fixtureId).build());
        return match;
    }

    private ApiFootballClient.ApiFixture fixture(long id, String status, Integer home, Integer away) {
        return new ApiFootballClient.ApiFixture(
                id, LocalDateTime.of(2026, 6, 11, 21, 0),
                "France", "Brésil", 1L, 2L, status, home, away);
    }

    // ── Quota ─────────────────────────────────────────────────────────────────

    @Test
    void fetchesAllLinkedFixturesInASingleBatchedCall() {
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 101L), linkedMatch(2L, 102L), linkedMatch(3L, 103L)));
        when(apiFootballClient.getFixtures(any())).thenReturn(List.of());

        matchSyncService.syncMatches();

        ArgumentCaptor<Collection<Long>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(apiFootballClient, times(1)).getFixtures(ids.capture());
        assertThat(ids.getValue()).containsExactlyInAnyOrder(101L, 102L, 103L);
    }

    @Test
    void doesNothingWhenApiKeyIsMissing() {
        when(apiFootballClient.isDisabled()).thenReturn(true);

        matchSyncService.syncMatches();

        verifyNoInteractions(matchRepository);
        verify(apiFootballClient, never()).getFixtures(any());
    }

    @Test
    void skipsMatchesWithoutAnExternalLink() {
        Match unlinked = Match.builder().id(9L).build();
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any())).thenReturn(List.of(unlinked));

        matchSyncService.syncMatches();

        verify(apiFootballClient, never()).getFixtures(any());
    }

    // ── Score propagation ─────────────────────────────────────────────────────

    @Test
    void pushesFinishedScoreToMatchService() {
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 101L)));
        when(apiFootballClient.getFixtures(any())).thenReturn(List.of(fixture(101L, "FT", 2, 1)));

        matchSyncService.syncMatches();

        verify(matchService).syncMatchScore(1L, 2, 1, Match.Status.FINISHED);
    }

    @Test
    void treatsLiveStatusAsOngoing() {
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 101L)));
        when(apiFootballClient.getFixtures(any())).thenReturn(List.of(fixture(101L, "1H", 0, 0)));

        matchSyncService.syncMatches();

        verify(matchService).syncMatchScore(1L, 0, 0, Match.Status.ONGOING);
    }

    @Test
    void ignoresFixturesInAnUnmappedStatus() {
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 101L)));
        when(apiFootballClient.getFixtures(any())).thenReturn(List.of(fixture(101L, "NS", null, null)));

        matchSyncService.syncMatches();

        verify(matchService, never()).syncMatchScore(anyLong(), anyInt(), anyInt(), any());
    }

    @Test
    void keepsSyncingOtherMatchesWhenTheFetchFails() {
        when(apiFootballClient.isDisabled()).thenReturn(false);
        when(matchRepository.findSyncableMatchesInWindow(any(), any()))
                .thenReturn(List.of(linkedMatch(1L, 101L)));
        when(apiFootballClient.getFixtures(any())).thenThrow(new IllegalStateException("api-football HTTP 429"));

        assertThatCode(() -> matchSyncService.syncMatches()).doesNotThrowAnyException();
        verify(matchService, never()).syncMatchScore(anyLong(), anyInt(), anyInt(), any());
    }
}
