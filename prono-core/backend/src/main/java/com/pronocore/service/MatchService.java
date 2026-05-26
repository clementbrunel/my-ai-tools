package com.pronocore.service;

import com.pronocore.dto.request.CreateMatchRequest;
import com.pronocore.dto.request.UpdateMatchScoreRequest;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.*;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository            matchRepository;
    private final MatchMapper                matchMapper;
    private final BetRepository              betRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final UserRepository             userRepository;
    private final UserForfeitRepository      userForfeitRepository;

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

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
        return matchMapper.toResponse(requireMatch(id));
    }

    // ---------------------------------------------------------------
    // Commands
    // ---------------------------------------------------------------

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
        Match match = requireMatch(id);

        boolean transitionsToFinished =
                match.getStatus() != Match.Status.FINISHED
                        && request.getStatus() == Match.Status.FINISHED;

        match.setScoreA(request.getScoreA());
        match.setScoreB(request.getScoreB());
        match.setStatus(request.getStatus());
        match = matchRepository.save(match);

        // Auto-settle all open bets when match becomes FINISHED
        if (transitionsToFinished
                && request.getScoreA() != null
                && request.getScoreB() != null) {
            settleBetsForMatch(match);
        }

        return matchMapper.toResponse(match);
    }

    @Transactional
    public void deleteMatch(Long id) {
        if (!matchRepository.existsById(id)) throw new EntityNotFoundException("Match not found: " + id);
        matchRepository.deleteById(id);
    }

    /** Used internally by BetService. */
    public Match findById(Long id) {
        return requireMatch(id);
    }

    // ---------------------------------------------------------------
    // Settlement logic
    // ---------------------------------------------------------------

    /**
     * When an admin marks a match as FINISHED:
     * <ol>
     *   <li>Compute the winning option string from the actual score.</li>
     *   <li>For each OPEN bet on this match: mark it VALIDATED, award points to
     *       participants whose {@code chosenOption} equals the winning option.</li>
     *   <li>Find the <em>biggest bettor</em>: user with the most participations
     *       across all bets on this match.</li>
     *   <li>Award {@code match.bettorBonus} extra points to that user (tie-breaker).</li>
     *   <li>If the match has a forfeit AND the biggest bettor has at least one wrong
     *       prediction → assign the forfeit automatically.</li>
     * </ol>
     *
     * <p>Winning-option format (winner's score always first):
     * <ul>
     *   <li>teamA wins 2-1  → {@code "Victoire France 2-1"}</li>
     *   <li>teamB wins 1-0  → {@code "Victoire Sénégal 1-0"}</li>
     *   <li>draw 0-0        → {@code "Match nul 0-0"}</li>
     * </ul>
     */
    private void settleBetsForMatch(Match match) {
        String winningOption = computeWinningOption(match);
        log.info("⚽ Settling match {} ({} vs {}) — winning option: {}",
                match.getId(), match.getTeamA(), match.getTeamB(), winningOption);

        List<Bet> openBets = betRepository
                .findByMatchIdAndStatusOrderByCreatedAtDesc(match.getId(), Bet.Status.OPEN);
        if (openBets.isEmpty()) {
            log.info("No open bets for match {}", match.getId());
            return;
        }

        // Per-user: participation count + whether they have ≥1 wrong prediction
        Map<Long, Long>    countByUser    = new HashMap<>();
        Map<Long, User>    userCache      = new HashMap<>();
        Map<Long, Boolean> hasWrongByUser = new HashMap<>();

        for (Bet bet : openBets) {
            List<BetParticipation> participations =
                    betParticipationRepository.findByBetId(bet.getId());

            for (BetParticipation p : participations) {
                User user = p.getUser();
                userCache.put(user.getId(), user);
                countByUser.merge(user.getId(), 1L, Long::sum);

                boolean correct = p.getChosenOption().trim().equals(winningOption);
                if (!correct) {
                    hasWrongByUser.put(user.getId(), true);
                } else {
                    user.setGlobalScore(user.getGlobalScore() + bet.getPoints());
                    user.setBetsWon(user.getBetsWon() + 1);
                    userRepository.save(user);
                }
            }

            bet.setStatus(Bet.Status.VALIDATED);
            bet.setWinningOption(winningOption);
            betRepository.save(bet);
        }

        if (countByUser.isEmpty()) return;

        // Biggest bettor = user with the most participations on this match
        Long biggestBettorId = countByUser.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        if (biggestBettorId == null) return;

        User biggestBettor = userCache.get(biggestBettorId);

        // Bonus points for the biggest bettor (always, win or lose)
        if (match.getBettorBonus() > 0) {
            biggestBettor.setGlobalScore(biggestBettor.getGlobalScore() + match.getBettorBonus());
            userRepository.save(biggestBettor);
            log.info("🏅 +{} bonus pts → {} ({} participations on this match)",
                    match.getBettorBonus(), biggestBettor.getUsername(),
                    countByUser.get(biggestBettorId));
        }

        // Forfeit: biggest bettor who has at least one wrong prediction gets the match gage
        if (match.getForfeit() != null
                && Boolean.TRUE.equals(hasWrongByUser.get(biggestBettorId))) {

            String adminUsername = SecurityContextHolder.getContext()
                    .getAuthentication().getName();
            User admin = userRepository.findByUsername(adminUsername)
                    .orElse(biggestBettor);

            UserForfeit uf = UserForfeit.builder()
                    .user(biggestBettor)
                    .forfeit(match.getForfeit())
                    .assignedBy(admin)
                    .completed(false)
                    .build();
            userForfeitRepository.save(uf);

            biggestBettor.setForfeitsReceived(biggestBettor.getForfeitsReceived() + 1);
            userRepository.save(biggestBettor);
            log.info("🃏 Forfeit '{}' assigned to {} for match {}",
                    match.getForfeit().getTitle(), biggestBettor.getUsername(), match.getId());
        }
    }

    /**
     * Winner's score is always written first.
     * e.g. France (team_a) 0 – 1 Sénégal (team_b) → "Victoire Sénégal 1-0"
     */
    private String computeWinningOption(Match match) {
        int sA = match.getScoreA(), sB = match.getScoreB();
        if (sA > sB) return "Victoire " + match.getTeamA() + " " + sA + "-" + sB;
        if (sB > sA) return "Victoire " + match.getTeamB() + " " + sB + "-" + sA;
        return "Match nul " + sA + "-" + sB;
    }

    private Match requireMatch(Long id) {
        return matchRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
    }
}
