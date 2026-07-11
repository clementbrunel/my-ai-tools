package com.pronocore.service;

import com.pronocore.dto.response.CompetitionResponse;
import com.pronocore.dto.response.TeamResponse;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Team;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.TeamRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CompetitionService {

    private final CompetitionRepository competitionRepository;
    private final TeamRepository        teamRepository;

    @Transactional(readOnly = true)
    public List<CompetitionResponse> getAllCompetitions() {
        return competitionRepository.findAllByOrderByNameAsc()
                .stream().map(c -> new CompetitionResponse(c.getId(), c.getName(), c.getSport())).toList();
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> getTeamsForCompetition(Long competitionId) {
        return competitionRepository.findById(competitionId)
                .map(c -> c.getTeams().stream()
                        .map(t -> new TeamResponse(t.getId(), t.getName(), t.getIso2())).toList())
                .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> getAllKnownTeams() {
        return teamRepository.findAllByOrderByNameAsc()
                .stream().map(t -> new TeamResponse(t.getId(), t.getName(), t.getIso2())).toList();
    }

    @Transactional
    public void createCompetition(String name) {
        if (competitionRepository.findByName(name).isEmpty()) {
            competitionRepository.save(Competition.builder().name(name).build());
        }
    }

    @Transactional
    public void addTeam(Long competitionId, Long teamId) {
        Competition competition = requireCompetition(competitionId);
        Team team = requireTeam(teamId);
        if (!competition.getTeams().contains(team)) {
            competition.getTeams().add(team);
        }
    }

    @Transactional
    public void removeTeam(Long competitionId, Long teamId) {
        competitionRepository.findById(competitionId)
                .ifPresent(c -> c.getTeams().removeIf(t -> t.getId().equals(teamId)));
    }

    @Transactional
    public void setTeams(Long competitionId, List<Long> teamIds) {
        Competition competition = requireCompetition(competitionId);
        List<Team> desired = teamIds.stream()
                .map(this::requireTeam)
                .toList();
        competition.getTeams().clear();
        competition.getTeams().addAll(desired);
    }

    /**
     * Looks up a team by exact name, creating it if it doesn't exist yet.
     * Used when an admin adds a brand-new team to a competition roster.
     */
    @Transactional
    public TeamResponse findOrCreateTeam(String name) {
        Team team = teamRepository.findByName(name)
                .orElseGet(() -> teamRepository.save(Team.builder().name(name).build()));
        return new TeamResponse(team.getId(), team.getName(), team.getIso2());
    }

    /**
     * Looks up a competition by exact name, creating it if it doesn't exist yet.
     * Used when creating a match without an explicit competitionId (defaults to the
     * current tournament) and by the roster helpers above.
     */
    @Transactional
    public Competition findOrCreateCompetition(String name) {
        return competitionRepository.findByName(name)
                .orElseGet(() -> competitionRepository.save(
                        Competition.builder().name(name).build()));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Competition requireCompetition(Long competitionId) {
        return competitionRepository.findById(competitionId)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + competitionId));
    }

    private Team requireTeam(Long teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + teamId));
    }
}
