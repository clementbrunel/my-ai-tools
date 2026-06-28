package com.pronocore.service;

import com.pronocore.entity.CompetitionTeam;
import com.pronocore.repository.CompetitionTeamRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompetitionServiceTest {

    @Mock private CompetitionTeamRepository competitionTeamRepository;

    @InjectMocks
    private CompetitionService competitionService;

    // ── getAllCompetitions ──────────────────────────────────────────────────────

    @Test
    void getAllCompetitions_delegatesToRepository() {
        when(competitionTeamRepository.findAllDistinctCompetitions())
                .thenReturn(List.of("Copa América 2026", "FIFA World Cup 2026"));

        List<String> result = competitionService.getAllCompetitions();

        assertThat(result).containsExactly("Copa América 2026", "FIFA World Cup 2026");
    }

    // ── getTeamsForCompetition ─────────────────────────────────────────────────

    @Test
    void getTeamsForCompetition_returnsTeamNamesInRosterOrder() {
        when(competitionTeamRepository.findByCompetitionOrderByTeamNameAsc("FIFA World Cup 2026"))
                .thenReturn(List.of(ct("Allemagne"), ct("Brésil"), ct("France")));

        List<String> result = competitionService.getTeamsForCompetition("FIFA World Cup 2026");

        assertThat(result).containsExactly("Allemagne", "Brésil", "France");
    }

    @Test
    void getTeamsForCompetition_returnsEmptyListWhenNoRoster() {
        when(competitionTeamRepository.findByCompetitionOrderByTeamNameAsc("FIFA World Cup 2026"))
                .thenReturn(List.of());

        assertThat(competitionService.getTeamsForCompetition("FIFA World Cup 2026")).isEmpty();
    }

    // ── getAllKnownTeams ───────────────────────────────────────────────────────

    @Test
    void getAllKnownTeams_delegatesToRepository() {
        when(competitionTeamRepository.findAllDistinctTeamNames())
                .thenReturn(List.of("Allemagne", "Argentine", "Brésil", "France"));

        List<String> result = competitionService.getAllKnownTeams();

        assertThat(result).containsExactly("Allemagne", "Argentine", "Brésil", "France");
    }

    // ── addTeam ───────────────────────────────────────────────────────────────

    @Test
    void addTeam_savesWhenTeamDoesNotExist() {
        when(competitionTeamRepository.existsByCompetitionAndTeamName("FIFA World Cup 2026", "Japon"))
                .thenReturn(false);

        competitionService.addTeam("FIFA World Cup 2026", "Japon");

        ArgumentCaptor<CompetitionTeam> captor = ArgumentCaptor.forClass(CompetitionTeam.class);
        verify(competitionTeamRepository).save(captor.capture());
        assertThat(captor.getValue().getCompetition()).isEqualTo("FIFA World Cup 2026");
        assertThat(captor.getValue().getTeamName()).isEqualTo("Japon");
    }

    @Test
    void addTeam_doesNotSaveWhenTeamAlreadyExists() {
        when(competitionTeamRepository.existsByCompetitionAndTeamName("FIFA World Cup 2026", "France"))
                .thenReturn(true);

        competitionService.addTeam("FIFA World Cup 2026", "France");

        verify(competitionTeamRepository, never()).save(any());
    }

    // ── removeTeam ────────────────────────────────────────────────────────────

    @Test
    void removeTeam_delegatesToRepository() {
        competitionService.removeTeam("FIFA World Cup 2026", "France");

        verify(competitionTeamRepository).deleteByCompetitionAndTeamName("FIFA World Cup 2026", "France");
    }

    // ── setTeams ──────────────────────────────────────────────────────────────

    @Test
    void setTeams_removesTeamsNotInDesiredList() {
        CompetitionTeam france    = ct("France");
        CompetitionTeam allemagne = ct("Allemagne");
        when(competitionTeamRepository.findByCompetitionOrderByTeamNameAsc("FIFA World Cup 2026"))
                .thenReturn(List.of(france, allemagne));
        when(competitionTeamRepository.existsByCompetitionAndTeamName(any(), any())).thenReturn(true);

        competitionService.setTeams("FIFA World Cup 2026", List.of("France"));

        verify(competitionTeamRepository).delete(allemagne);
        verify(competitionTeamRepository, never()).delete(france);
    }

    @Test
    void setTeams_addsTeamsNotYetInRoster() {
        when(competitionTeamRepository.findByCompetitionOrderByTeamNameAsc("FIFA World Cup 2026"))
                .thenReturn(List.of(ct("France")));
        when(competitionTeamRepository.existsByCompetitionAndTeamName("FIFA World Cup 2026", "France"))
                .thenReturn(true);
        when(competitionTeamRepository.existsByCompetitionAndTeamName("FIFA World Cup 2026", "Brésil"))
                .thenReturn(false);

        competitionService.setTeams("FIFA World Cup 2026", List.of("France", "Brésil"));

        ArgumentCaptor<CompetitionTeam> captor = ArgumentCaptor.forClass(CompetitionTeam.class);
        verify(competitionTeamRepository).save(captor.capture());
        assertThat(captor.getValue().getTeamName()).isEqualTo("Brésil");
    }

    @Test
    void setTeams_doesNotAddAlreadyExistingTeams() {
        CompetitionTeam france = ct("France");
        when(competitionTeamRepository.findByCompetitionOrderByTeamNameAsc("FIFA World Cup 2026"))
                .thenReturn(List.of(france));
        when(competitionTeamRepository.existsByCompetitionAndTeamName("FIFA World Cup 2026", "France"))
                .thenReturn(true);

        competitionService.setTeams("FIFA World Cup 2026", List.of("France"));

        verify(competitionTeamRepository, never()).save(any());
        verify(competitionTeamRepository, never()).delete(any(CompetitionTeam.class));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static CompetitionTeam ct(String teamName) {
        return CompetitionTeam.builder()
                .competition("FIFA World Cup 2026")
                .teamName(teamName)
                .build();
    }
}
