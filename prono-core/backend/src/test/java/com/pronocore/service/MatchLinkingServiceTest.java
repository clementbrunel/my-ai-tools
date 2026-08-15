package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.entity.Competition;
import com.pronocore.entity.ExternalApi;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.entity.Sport;
import com.pronocore.entity.Team;
import com.pronocore.repository.ExternalApiRepository;
import com.pronocore.repository.MatchExternalLinksRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchLinkingServiceTest {

    @Mock private MatchService                 matchService;
    @Mock private ApiFootballClient            apiFootballClient;
    @Mock private TeamMappingService           teamMappingService;
    @Mock private MatchExternalLinksRepository linksRepository;
    @Mock private ExternalApiRepository        externalApiRepository;

    @InjectMocks
    private MatchLinkingService matchLinkingService;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private ExternalApi apiFootball() {
        return ExternalApi.builder()
                .id(1L).name("API-Football").code("API-FOOTBALL").sport(Sport.FOOT)
                .build();
    }

    private ExternalApi jolpica() {
        return ExternalApi.builder()
                .id(2L).name("jolpica-f1").code("JOLPICA").sport(Sport.F1)
                .build();
    }

    // ── findCandidates ────────────────────────────────────────────────────────

    @Test
    void findCandidates_throwsWhenCompetitionHasNoLeagueIdConfigured() {
        Competition competition = Competition.builder().id(1L).name("Ligue 1").season(2026).build();
        Match match = Match.builder().id(10L).competition(competition)
                .teamA(Team.builder().id(1L).name("PSG").build())
                .teamB(Team.builder().id(2L).name("OM").build())
                .matchDate(LocalDateTime.of(2026, 8, 20, 21, 0))
                .build();
        when(matchService.findById(10L)).thenReturn(match);

        assertThatThrownBy(() -> matchLinkingService.findCandidates(10L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Ligue 1");

        verifyNoInteractions(apiFootballClient);
    }

    @Test
    void findCandidates_scoresFixturesFromTheCompetitionsOwnLeague() {
        Competition competition = Competition.builder().id(1L).name("Ligue 1")
                .season(2026).apiFootballLeagueId(61).build();
        Team psg = Team.builder().id(1L).name("PSG").build();
        Team om = Team.builder().id(2L).name("OM").build();
        LocalDateTime kickoff = LocalDateTime.of(2026, 8, 20, 21, 0);
        Match match = Match.builder().id(10L).competition(competition)
                .teamA(psg).teamB(om).matchDate(kickoff).build();
        when(matchService.findById(10L)).thenReturn(match);
        when(teamMappingService.getTeamId("PSG", 61, 2026)).thenReturn(100L);
        when(teamMappingService.getTeamId("OM", 61, 2026)).thenReturn(200L);

        ApiFootballClient.ApiFixture fixture = new ApiFootballClient.ApiFixture(
                999L, kickoff, "PSG", "OM", 100L, 200L, "NS", null, null, "Regular Season - 1");
        when(apiFootballClient.getAllFixtures(61, 2026)).thenReturn(List.of(fixture));

        List<FixtureCandidateResponse> candidates = matchLinkingService.findCandidates(10L);

        assertThat(candidates).hasSize(1);
        assertThat(candidates.get(0).getFixtureId()).isEqualTo(999L);
        assertThat(candidates.get(0).isAutoLinkable()).isTrue();
    }

    // ── linkMatch ─────────────────────────────────────────────────────────────

    @Test
    void linkMatch_storesFixtureId_whenProviderIsRegisteredFootballApi() {
        Match match = Match.builder().id(10L).build();
        when(externalApiRepository.findByCode("API-FOOTBALL")).thenReturn(Optional.of(apiFootball()));
        when(matchService.findById(10L)).thenReturn(match);
        when(linksRepository.findById(10L)).thenReturn(Optional.empty());

        matchLinkingService.linkMatch(10L, 999L, "API-FOOTBALL");

        ArgumentCaptor<MatchExternalLinks> captor = ArgumentCaptor.forClass(MatchExternalLinks.class);
        verify(linksRepository).save(captor.capture());
        assertThat(captor.getValue().getApiFootballFixtureId()).isEqualTo(999L);
    }

    @Test
    void linkMatch_rejectsUnknownProviderCode() {
        when(externalApiRepository.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> matchLinkingService.linkMatch(10L, 999L, "NOPE"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("NOPE");

        verify(linksRepository, never()).save(any());
    }

    @Test
    void linkMatch_rejectsProviderRegisteredForAnotherSport() {
        when(externalApiRepository.findByCode("JOLPICA")).thenReturn(Optional.of(jolpica()));

        assertThatThrownBy(() -> matchLinkingService.linkMatch(10L, 999L, "JOLPICA"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("F1");

        verify(linksRepository, never()).save(any());
    }

    // ── unlinkMatch ───────────────────────────────────────────────────────────

    @Test
    void unlinkMatch_deletesRow_whenNoLinkRemains() {
        MatchExternalLinks links = MatchExternalLinks.builder()
                .matchId(10L).apiFootballFixtureId(999L).build();
        when(externalApiRepository.findByCode("API-FOOTBALL")).thenReturn(Optional.of(apiFootball()));
        when(linksRepository.findById(10L)).thenReturn(Optional.of(links));

        matchLinkingService.unlinkMatch(10L, "API-FOOTBALL");

        verify(linksRepository).delete(links);
        verify(linksRepository, never()).save(any());
    }

    @Test
    void unlinkMatch_rejectsUnknownProviderCode() {
        when(externalApiRepository.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> matchLinkingService.unlinkMatch(10L, "NOPE"))
                .isInstanceOf(EntityNotFoundException.class);

        verify(linksRepository, never()).delete(any());
    }
}
