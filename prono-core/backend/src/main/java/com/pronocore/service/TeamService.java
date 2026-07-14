package com.pronocore.service;

import com.pronocore.dto.response.MatchResponse;
import com.pronocore.dto.response.TeamResponse;
import com.pronocore.entity.Team;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.TeamRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final MatchMapper matchMapper;

    @Transactional(readOnly = true)
    public TeamResponse getTeamById(Long id) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + id));
        return new TeamResponse(team.getId(), team.getName(), team.getIso2());
    }

    @Transactional(readOnly = true)
    public List<MatchResponse> getTeamMatches(Long teamId) {
        if (!teamRepository.existsById(teamId)) {
            throw new EntityNotFoundException("Team not found: " + teamId);
        }
        return matchRepository.findByTeam_IdOrderByMatchDateDesc(teamId).stream()
                .map(matchMapper::toResponse)
                .toList();
    }
}
