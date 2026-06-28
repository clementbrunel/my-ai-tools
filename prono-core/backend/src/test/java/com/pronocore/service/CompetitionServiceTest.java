package com.pronocore.service;

import com.pronocore.entity.Competition;
import com.pronocore.entity.Team;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.TeamRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompetitionServiceTest {

    @Mock private CompetitionRepository competitionRepository;
    @Mock private TeamRepository        teamRepository;

    @InjectMocks
    private CompetitionService competitionService;

    // ── getAllCompetitions ──────────────────────────────────────────────────────

    @Test
    void getAllCompetitions_returnsNamesInOrder() {
        when(competitionRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(competition("Copa América 2026"), competition("FIFA World Cup 2026")));

        assertThat(competitionService.getAllCompetitions())
                .containsExactly("Copa América 2026", "FIFA World Cup 2026");
    }

    // ── getTeamsForCompetition ─────────────────────────────────────────────────

    @Test
    void getTeamsForCompetition_returnsTeamNames() {
        Competition comp = competition("FIFA World Cup 2026", team("France"), team("Brésil"));
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));

        assertThat(competitionService.getTeamsForCompetition("FIFA World Cup 2026"))
                .extracting("name")
                .containsExactly("France", "Brésil");
    }

    @Test
    void getTeamsForCompetition_returnsEmptyListWhenCompetitionUnknown() {
        when(competitionRepository.findByName("Unknown")).thenReturn(Optional.empty());

        assertThat(competitionService.getTeamsForCompetition("Unknown")).isEmpty();
    }

    // ── getAllKnownTeams ───────────────────────────────────────────────────────

    @Test
    void getAllKnownTeams_returnsAllTeamNamesInOrder() {
        when(teamRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(team("Allemagne"), team("France")));

        assertThat(competitionService.getAllKnownTeams())
                .containsExactly("Allemagne", "France");
    }

    // ── addTeam ───────────────────────────────────────────────────────────────

    @Test
    void addTeam_addsTeamToExistingCompetition() {
        Competition comp = competition("FIFA World Cup 2026");
        Team japon = team("Japon");
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findByName("Japon")).thenReturn(Optional.of(japon));

        competitionService.addTeam("FIFA World Cup 2026", "Japon");

        assertThat(comp.getTeams()).contains(japon);
    }

    @Test
    void addTeam_createsCompetitionIfAbsent() {
        Competition newComp = competition("Nouvelle Compétition");
        Team team = team("France");
        when(competitionRepository.findByName("Nouvelle Compétition")).thenReturn(Optional.empty());
        when(competitionRepository.save(any())).thenReturn(newComp);
        when(teamRepository.findByName("France")).thenReturn(Optional.of(team));

        competitionService.addTeam("Nouvelle Compétition", "France");

        verify(competitionRepository).save(any(Competition.class));
    }

    @Test
    void addTeam_createsTeamIfAbsent() {
        Competition comp = competition("FIFA World Cup 2026");
        Team newTeam = team("Inconnue");
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findByName("Inconnue")).thenReturn(Optional.empty());
        when(teamRepository.save(any())).thenReturn(newTeam);

        competitionService.addTeam("FIFA World Cup 2026", "Inconnue");

        verify(teamRepository).save(any(Team.class));
        assertThat(comp.getTeams()).contains(newTeam);
    }

    @Test
    void addTeam_doesNotDuplicateIfAlreadyInRoster() {
        Team france = team("France");
        Competition comp = competition("FIFA World Cup 2026", france);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findByName("France")).thenReturn(Optional.of(france));

        competitionService.addTeam("FIFA World Cup 2026", "France");

        assertThat(comp.getTeams()).hasSize(1);
    }

    // ── removeTeam ────────────────────────────────────────────────────────────

    @Test
    void removeTeam_removesMatchingTeam() {
        Team france = team("France");
        Competition comp = competition("FIFA World Cup 2026", france);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));

        competitionService.removeTeam("FIFA World Cup 2026", "France");

        assertThat(comp.getTeams()).isEmpty();
    }

    @Test
    void removeTeam_isNoOpWhenCompetitionUnknown() {
        when(competitionRepository.findByName("Unknown")).thenReturn(Optional.empty());

        competitionService.removeTeam("Unknown", "France"); // must not throw
    }

    @Test
    void createCompetition_persistsWhenNew() {
        when(competitionRepository.findByName("Copa América 2026")).thenReturn(Optional.empty());

        competitionService.createCompetition("Copa América 2026");

        verify(competitionRepository).save(argThat(c -> "Copa América 2026".equals(c.getName())));
    }

    @Test
    void createCompetition_isNoOpWhenAlreadyExists() {
        when(competitionRepository.findByName("FIFA World Cup 2026"))
                .thenReturn(Optional.of(competition("FIFA World Cup 2026")));

        competitionService.createCompetition("FIFA World Cup 2026");

        verify(competitionRepository, never()).save(any());
    }

    // ── setTeams ──────────────────────────────────────────────────────────────

    @Test
    void setTeams_replacesRosterCompletely() {
        Team france = team("France");
        Team bresil = team("Brésil");
        Team allemagne = team("Allemagne");
        Competition comp = competition("FIFA World Cup 2026", france, bresil);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findByName("Allemagne")).thenReturn(Optional.of(allemagne));

        competitionService.setTeams("FIFA World Cup 2026", List.of("Allemagne"));

        assertThat(comp.getTeams()).containsExactly(allemagne);
    }

    @Test
    void setTeams_createsCompetitionIfAbsent() {
        Competition newComp = competition("Nouvelle");
        Team team = team("France");
        when(competitionRepository.findByName("Nouvelle")).thenReturn(Optional.empty());
        when(competitionRepository.save(any())).thenReturn(newComp);
        when(teamRepository.findByName("France")).thenReturn(Optional.of(team));

        competitionService.setTeams("Nouvelle", List.of("France"));

        verify(competitionRepository).save(any(Competition.class));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static Competition competition(String name, Team... teams) {
        Competition c = Competition.builder().name(name).build();
        c.setTeams(new ArrayList<>(List.of(teams)));
        return c;
    }

    private static Team team(String name) {
        return Team.builder().name(name).build();
    }
}
