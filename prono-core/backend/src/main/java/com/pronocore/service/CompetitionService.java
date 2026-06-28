package com.pronocore.service;

import com.pronocore.entity.Competition;
import com.pronocore.entity.Team;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.TeamRepository;
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
    public List<String> getAllCompetitions() {
        return competitionRepository.findAllByOrderByNameAsc()
                .stream().map(Competition::getName).toList();
    }

    @Transactional(readOnly = true)
    public List<String> getTeamsForCompetition(String competitionName) {
        return competitionRepository.findByName(competitionName)
                .map(c -> c.getTeams().stream().map(Team::getName).toList())
                .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public List<String> getAllKnownTeams() {
        return teamRepository.findAllByOrderByNameAsc()
                .stream().map(Team::getName).toList();
    }

    @Transactional
    public void createCompetition(String name) {
        if (competitionRepository.findByName(name).isEmpty()) {
            competitionRepository.save(Competition.builder().name(name).build());
        }
    }

    @Transactional
    public void addTeam(String competitionName, String teamName) {
        Competition competition = findOrCreateCompetition(competitionName);
        Team team = findOrCreateTeam(teamName);
        if (!competition.getTeams().contains(team)) {
            competition.getTeams().add(team);
        }
    }

    @Transactional
    public void removeTeam(String competitionName, String teamName) {
        competitionRepository.findByName(competitionName)
                .ifPresent(c -> c.getTeams().removeIf(t -> t.getName().equals(teamName)));
    }

    @Transactional
    public void setTeams(String competitionName, List<String> teamNames) {
        Competition competition = findOrCreateCompetition(competitionName);
        List<Team> desired = teamNames.stream()
                .map(this::findOrCreateTeam)
                .toList();
        competition.getTeams().clear();
        competition.getTeams().addAll(desired);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Competition findOrCreateCompetition(String name) {
        return competitionRepository.findByName(name)
                .orElseGet(() -> competitionRepository.save(
                        Competition.builder().name(name).build()));
    }

    private Team findOrCreateTeam(String name) {
        return teamRepository.findByName(name)
                .orElseGet(() -> teamRepository.save(
                        Team.builder().name(name).build()));
    }
}
