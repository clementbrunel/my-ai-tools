package com.pronocore.service;

import com.pronocore.client.ApiFootballClient;
import com.pronocore.dto.response.CompetitionResponse;
import com.pronocore.dto.response.TeamResponse;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Sport;
import com.pronocore.entity.Team;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.RaceRepository;
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
    private final MatchRepository       matchRepository;
    private final RaceRepository        raceRepository;
    private final ApiFootballClient     apiFootballClient;

    /**
     * @param sports restricts the result to these sports; null or empty returns every competition.
     */
    @Transactional(readOnly = true)
    public List<CompetitionResponse> getAllCompetitions(List<Sport> sports) {
        List<Competition> competitions = (sports == null || sports.isEmpty())
                ? competitionRepository.findAllByOrderByNameAsc()
                : competitionRepository.findAllBySportInOrderByNameAsc(sports);
        return competitions.stream()
                .map(c -> new CompetitionResponse(c.getId(), c.getName(), c.getSport(), c.isActive(), c.getSeason(),
                        c.getApiFootballLeagueId()))
                .toList();
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
    public void createCompetition(String name, Sport sport) {
        if (competitionRepository.findByName(name).isEmpty()) {
            competitionRepository.save(Competition.builder()
                    .name(name)
                    .sport(sport)
                    .build());
        }
    }

    @Transactional
    public void setActive(Long competitionId, boolean active) {
        requireCompetition(competitionId).setActive(active);
    }

    @Transactional
    public void setSeason(Long competitionId, Integer season) {
        requireCompetition(competitionId).setSeason(season);
    }

    @Transactional
    public void setApiFootballLeagueId(Long competitionId, Integer leagueId) {
        requireCompetition(competitionId).setApiFootballLeagueId(leagueId);
    }

    /**
     * Imports (or refreshes) a competition's roster from api-football, using its
     * configured league id and season. Teams are matched/created by exact name —
     * new club teams are added to the roster, existing ones are left untouched.
     */
    @Transactional
    public List<TeamResponse> syncTeamsFromApiFootball(Long competitionId) {
        Competition competition = requireCompetition(competitionId);
        Integer leagueId = competition.getApiFootballLeagueId();
        Integer season = competition.getSeason();
        if (leagueId == null || season == null) {
            throw new IllegalStateException("Competition \"" + competition.getName()
                    + "\" has no api-football league id / season configured");
        }
        if (apiFootballClient.isDisabled()) {
            throw new IllegalStateException("api-football sync is disabled — no API_FOOTBALL_KEY configured");
        }

        for (ApiFootballClient.ApiTeam apiTeam : apiFootballClient.getTeams(leagueId, season)) {
            Team team = teamRepository.findByName(apiTeam.name())
                    .orElseGet(() -> teamRepository.save(Team.builder().name(apiTeam.name()).build()));
            if (!competition.getTeams().contains(team)) {
                competition.getTeams().add(team);
            }
        }

        return competition.getTeams().stream()
                .map(t -> new TeamResponse(t.getId(), t.getName(), t.getIso2()))
                .toList();
    }

    @Transactional
    public void deleteCompetition(Long competitionId) {
        Competition competition = requireCompetition(competitionId);
        if (matchRepository.existsByCompetition_Id(competitionId) || raceRepository.existsByCompetition_Id(competitionId)) {
            throw new IllegalStateException("Impossible de supprimer une compétition qui a des matchs ou courses associés");
        }
        competitionRepository.delete(competition);
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
