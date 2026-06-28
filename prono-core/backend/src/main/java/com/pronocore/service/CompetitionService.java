package com.pronocore.service;

import com.pronocore.entity.CompetitionTeam;
import com.pronocore.repository.CompetitionTeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CompetitionService {

    private final CompetitionTeamRepository competitionTeamRepository;

    @Transactional(readOnly = true)
    public List<String> getAllCompetitions() {
        return competitionTeamRepository.findAllDistinctCompetitions();
    }

    @Transactional(readOnly = true)
    public List<String> getTeamsForCompetition(String competition) {
        return competitionTeamRepository.findByCompetitionOrderByTeamNameAsc(competition)
                .stream().map(CompetitionTeam::getTeamName).toList();
    }

    @Transactional(readOnly = true)
    public List<String> getAllKnownTeams() {
        return competitionTeamRepository.findAllDistinctTeamNames();
    }

    @Transactional
    public void addTeam(String competition, String teamName) {
        if (!competitionTeamRepository.existsByCompetitionAndTeamName(competition, teamName)) {
            competitionTeamRepository.save(
                    CompetitionTeam.builder().competition(competition).teamName(teamName).build());
        }
    }

    @Transactional
    public void removeTeam(String competition, String teamName) {
        competitionTeamRepository.deleteByCompetitionAndTeamName(competition, teamName);
    }

    /** Replace the full roster for a competition in one go. */
    @Transactional
    public void setTeams(String competition, List<String> teamNames) {
        List<CompetitionTeam> existing = competitionTeamRepository
                .findByCompetitionOrderByTeamNameAsc(competition);

        Set<String> desired = new LinkedHashSet<>(teamNames);

        existing.stream()
                .filter(ct -> !desired.contains(ct.getTeamName()))
                .forEach(competitionTeamRepository::delete);

        desired.forEach(name -> {
            if (!competitionTeamRepository.existsByCompetitionAndTeamName(competition, name)) {
                competitionTeamRepository.save(
                        CompetitionTeam.builder().competition(competition).teamName(name).build());
            }
        });
    }
}
