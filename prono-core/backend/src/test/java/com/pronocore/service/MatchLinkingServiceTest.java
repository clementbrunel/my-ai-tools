package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.entity.ExternalApi;
import com.pronocore.entity.Match;
import com.pronocore.entity.MatchExternalLinks;
import com.pronocore.entity.Sport;
import com.pronocore.repository.ExternalApiRepository;
import com.pronocore.repository.MatchExternalLinksRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
