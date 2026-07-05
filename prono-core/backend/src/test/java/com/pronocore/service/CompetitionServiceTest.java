package com.pronocore.service;

import com.pronocore.entity.Competition;
import com.pronocore.entity.Team;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.TeamRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompetitionServiceTest {

    private static final Team TEAM_FRANCE    = team(1L, "France");
    private static final Team TEAM_BRESIL    = team(2L, "Brésil");
    private static final Team TEAM_ALLEMAGNE = team(3L, "Allemagne");
    private static final Team TEAM_JAPON     = team(4L, "Japon");
    private static final Team TEAM_INCONNUE  = team(5L, "Inconnue");

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
        Competition comp = competition("FIFA World Cup 2026", TEAM_FRANCE, TEAM_BRESIL);
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
    void getAllKnownTeams_returnsAllTeamsInOrder() {
        when(teamRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(TEAM_ALLEMAGNE, TEAM_FRANCE));

        assertThat(competitionService.getAllKnownTeams())
                .extracting("name")
                .containsExactly("Allemagne", "France");
    }

    // ── addTeam ───────────────────────────────────────────────────────────────

    @Test
    void addTeam_addsTeamToExistingCompetition() {
        Competition comp = competition("FIFA World Cup 2026");
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findById(TEAM_JAPON.getId())).thenReturn(Optional.of(TEAM_JAPON));

        competitionService.addTeam("FIFA World Cup 2026", TEAM_JAPON.getId());

        assertThat(comp.getTeams()).contains(TEAM_JAPON);
    }

    @Test
    void addTeam_createsCompetitionIfAbsent() {
        Competition newComp = competition("Nouvelle Compétition");
        when(competitionRepository.findByName("Nouvelle Compétition")).thenReturn(Optional.empty());
        when(competitionRepository.save(any())).thenReturn(newComp);
        when(teamRepository.findById(TEAM_FRANCE.getId())).thenReturn(Optional.of(TEAM_FRANCE));

        competitionService.addTeam("Nouvelle Compétition", TEAM_FRANCE.getId());

        verify(competitionRepository).save(any(Competition.class));
    }

    @Test
    void addTeam_throwsWhenTeamUnknown() {
        Competition comp = competition("FIFA World Cup 2026");
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> competitionService.addTeam("FIFA World Cup 2026", 99L));
    }

    @Test
    void addTeam_doesNotDuplicateIfAlreadyInRoster() {
        Competition comp = competition("FIFA World Cup 2026", TEAM_FRANCE);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findById(TEAM_FRANCE.getId())).thenReturn(Optional.of(TEAM_FRANCE));

        competitionService.addTeam("FIFA World Cup 2026", TEAM_FRANCE.getId());

        assertThat(comp.getTeams()).hasSize(1);
    }

    // ── findOrCreateTeam ──────────────────────────────────────────────────────

    @Test
    void findOrCreateTeam_returnsExistingTeam() {
        when(teamRepository.findByName("France")).thenReturn(Optional.of(TEAM_FRANCE));

        assertThat(competitionService.findOrCreateTeam("France").id()).isEqualTo(TEAM_FRANCE.getId());
        verify(teamRepository, never()).save(any());
    }

    @Test
    void findOrCreateTeam_createsTeamIfAbsent() {
        when(teamRepository.findByName("Inconnue")).thenReturn(Optional.empty());
        when(teamRepository.save(any())).thenReturn(TEAM_INCONNUE);

        assertThat(competitionService.findOrCreateTeam("Inconnue").name()).isEqualTo("Inconnue");
        verify(teamRepository).save(any(Team.class));
    }

    // ── removeTeam ────────────────────────────────────────────────────────────

    @Test
    void removeTeam_removesMatchingTeam() {
        Competition comp = competition("FIFA World Cup 2026", TEAM_FRANCE);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));

        competitionService.removeTeam("FIFA World Cup 2026", TEAM_FRANCE.getId());

        assertThat(comp.getTeams()).isEmpty();
    }

    @Test
    void removeTeam_isNoOpWhenCompetitionUnknown() {
        when(competitionRepository.findByName("Unknown")).thenReturn(Optional.empty());

        competitionService.removeTeam("Unknown", TEAM_FRANCE.getId()); // must not throw
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
        Competition comp = competition("FIFA World Cup 2026", TEAM_FRANCE, TEAM_BRESIL);
        when(competitionRepository.findByName("FIFA World Cup 2026")).thenReturn(Optional.of(comp));
        when(teamRepository.findById(TEAM_ALLEMAGNE.getId())).thenReturn(Optional.of(TEAM_ALLEMAGNE));

        competitionService.setTeams("FIFA World Cup 2026", List.of(TEAM_ALLEMAGNE.getId()));

        assertThat(comp.getTeams()).containsExactly(TEAM_ALLEMAGNE);
    }

    @Test
    void setTeams_createsCompetitionIfAbsent() {
        Competition newComp = competition("Nouvelle");
        when(competitionRepository.findByName("Nouvelle")).thenReturn(Optional.empty());
        when(competitionRepository.save(any())).thenReturn(newComp);
        when(teamRepository.findById(TEAM_FRANCE.getId())).thenReturn(Optional.of(TEAM_FRANCE));

        competitionService.setTeams("Nouvelle", List.of(TEAM_FRANCE.getId()));

        verify(competitionRepository).save(any(Competition.class));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static Competition competition(String name, Team... teams) {
        Competition c = Competition.builder().name(name).build();
        c.setTeams(new ArrayList<>(List.of(teams)));
        return c;
    }

    private static Team team(Long id, String name) {
        return Team.builder().id(id).name(name).build();
    }
}
