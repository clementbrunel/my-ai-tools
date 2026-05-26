package com.pronocore.service;

import com.pronocore.dto.request.CreateMatchRequest;
import com.pronocore.dto.request.UpdateMatchScoreRequest;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.Match;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.repository.MatchRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;
    private final MatchMapper matchMapper;

    @Transactional(readOnly = true)
    public List<MatchResponse> getAllMatches() {
        return matchRepository.findAllByOrderByMatchDateAsc().stream()
            .map(matchMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MatchResponse> getMatchesByStatus(Match.Status status) {
        return matchRepository.findByStatusOrderByMatchDateAsc(status).stream()
            .map(matchMapper::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public MatchResponse getMatchById(Long id) {
        Match match = matchRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
        return matchMapper.toResponse(match);
    }

    @Transactional
    public MatchResponse createMatch(CreateMatchRequest request) {
        Match match = Match.builder()
            .teamA(request.getTeamA())
            .teamB(request.getTeamB())
            .matchDate(request.getMatchDate())
            .competition(request.getCompetition() != null ? request.getCompetition() : "FIFA World Cup 2026")
            .round(request.getRound() != null ? request.getRound() : "Group Stage")
            .status(Match.Status.UPCOMING)
            .build();
        return matchMapper.toResponse(matchRepository.save(match));
    }

    @Transactional
    public MatchResponse updateMatchScore(Long id, UpdateMatchScoreRequest request) {
        Match match = matchRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
        match.setScoreA(request.getScoreA());
        match.setScoreB(request.getScoreB());
        match.setStatus(request.getStatus());
        return matchMapper.toResponse(matchRepository.save(match));
    }

    @Transactional
    public void deleteMatch(Long id) {
        if (!matchRepository.existsById(id)) {
            throw new EntityNotFoundException("Match not found: " + id);
        }
        matchRepository.deleteById(id);
    }

    public Match findById(Long id) {
        return matchRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
    }
}
