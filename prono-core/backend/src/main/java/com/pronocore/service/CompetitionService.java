package com.pronocore.service;

import com.pronocore.entity.CompetitionTeam;
import com.pronocore.repository.CompetitionTeamRepository;
import com.pronocore.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class CompetitionService {

    private final CompetitionTeamRepository competitionTeamRepository;
    private final MatchRepository           matchRepository;

    /** All competition names — from the roster table AND from existing matches. */
    @Transactional(readOnly = true)
    public List<String> getAllCompetitions() {
        Set<String> result = new TreeSet<>(competitionTeamRepository.findAllDistinctCompetitions());
        result.addAll(matchRepository.findAllDistinctCompetitions());
        return result.stream().toList();
    }

    /**
     * Teams registered for a competition (roster table), merged with teams already present
     * in existing matches — so pool matches already played are never lost.
     */
    @Transactional(readOnly = true)
    public List<String> getTeamsForCompetition(String competition) {
        Set<String> result = new TreeSet<>();
        competitionTeamRepository.findByCompetitionOrderByTeamNameAsc(competition)
                .forEach(ct -> result.add(ct.getTeamName()));
        matchRepository.findByCompetitionOrderByMatchDateAsc(competition)
                .forEach(m -> { result.add(m.getTeamA()); result.add(m.getTeamB()); });
        return result.stream().toList();
    }

    /**
     * All distinct team names known across the whole platform (roster + matches),
     * used to populate the picker when initialising a new competition.
     */
    @Transactional(readOnly = true)
    public List<String> getAllKnownTeams() {
        Set<String> result = new TreeSet<>(competitionTeamRepository.findAllDistinctTeamNames());
        matchRepository.findAllByOrderByMatchDateAsc()
                .forEach(m -> { result.add(m.getTeamA()); result.add(m.getTeamB()); });
        return result.stream().toList();
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
