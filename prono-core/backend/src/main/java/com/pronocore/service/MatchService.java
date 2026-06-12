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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository            matchRepository;
    private final MatchMapper                matchMapper;
    private final BetRepository              betRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final UserRepository             userRepository;
    private final DailyGageService           dailyGageService;

    // ---------------------------------------------------------------
    // Scoring constants
    // ---------------------------------------------------------------

    /** Exact score. */
    static final int POINTS_EXACT_SCORE    = 5;
    /** Correct result (right winner or right draw), wrong score. */
    static final int POINTS_CORRECT_RESULT = 3;

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<MatchResponse> getAllMatches() {
        return matchRepository.findAllByOrderByMatchDateAsc().stream()
                .map(matchMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MatchResponse> getMatchesByStatus(Match.Status status) {
        return matchRepository.findByStatusOrderByMatchDateAsc(status).stream()
                .map(matchMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MatchResponse getMatchById(Long id) {
        return matchMapper.toResponse(requireMatch(id));
    }

    @Transactional(readOnly = true)
    public List<String> getActiveCompetitions() {
        return matchRepository.findActiveCompetitions();
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
        match = matchRepository.save(match);
        // A match is global and starts CLOSED to betting. Each group's admin opens it
        // for their group via BetService.openMatchForBetting → no auto-created bet here.
        return matchMapper.toResponse(match);
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

        if (transitionsToFinished && request.getScoreA() != null && request.getScoreB() != null) {
            settleBetsForMatch(match);
            // After settling, check if the whole day is done → assign daily gage
            dailyGageService.onMatchSettled(match.getMatchDate().toLocalDate());
        }

        return matchMapper.toResponse(match);
    }

    @Transactional
    public void deleteMatch(Long id) {
        if (!matchRepository.existsById(id)) throw new EntityNotFoundException("Match not found: " + id);
        matchRepository.deleteById(id);
    }

    public Match findById(Long id) { return requireMatch(id); }

    // ---------------------------------------------------------------
    // Settlement logic
    // ---------------------------------------------------------------

    /**
     * When admin marks a match as FINISHED:
     * 1. Compute the winning option string.
     * 2. Award +5 (exact score) or +3 (correct result) to each participant.
     *    Both +5 and +3 count as a "won bet" (betsWon++).
     * 3. Store pointsEarned on each participation (used by daily gage loser logic).
     *
     * Note: per-match forfeit assignment has been removed.
     * Gages are now assigned per day via DailyGageService.onMatchSettled().
     *
     * Winning-option format (winner's score always first):
     *   teamA wins 2-1  → "Victoire France 2-1"
     *   teamB wins 1-0  → "Victoire Sénégal 1-0"
     *   draw 0-0        → "Match nul 0-0"
     */
    private void settleBetsForMatch(Match match) {
        String winningOption = computeWinningOption(match);
        log.info("⚽ Settling match {} ({} vs {}) — winning option: {}",
                match.getId(), match.getTeamA(), match.getTeamB(), winningOption);

        List<Bet> openBets = betRepository
                .findByMatchIdAndStatusOrderByCreatedAtDesc(match.getId(), Bet.Status.OPEN);
        if (openBets.isEmpty()) {
            log.info("  No OPEN bets for match {} — nothing to settle", match.getId());
            return;
        }

        log.info("  {} OPEN bet(s) — groups: {}", openBets.size(),
                openBets.stream()
                        .map(b -> b.getGroup() != null
                                ? b.getGroup().getName() + " [id=" + b.getGroup().getId() + "]"
                                : "[no group]")
                        .collect(Collectors.joining(", ")));

        for (Bet bet : openBets) {
            String groupName = bet.getGroup() != null ? bet.getGroup().getName() : "?";
            List<BetParticipation> participations = betParticipationRepository.findByBetId(bet.getId());

            for (BetParticipation p : participations) {
                User user = p.getUser();
                int earned = computeEarnedPoints(p.getChosenOption().trim(), winningOption);
                p.setPointsEarned(earned);
                betParticipationRepository.save(p);

                if (earned > 0) {
                    user.setGlobalScore(user.getGlobalScore() + earned);
                    // Both +3 (correct result) and +5 (exact score) count as a won bet
                    user.setBetsWon(user.getBetsWon() + 1);
                    userRepository.save(user);
                    log.info("  +{} pts → {} ({}) [group: {}]",
                            earned, user.getUsername(), p.getChosenOption(), groupName);
                } else {
                    log.debug("  +0 pts → {} ({}) [group: {}]",
                            user.getUsername(), p.getChosenOption(), groupName);
                }
            }

            bet.setStatus(Bet.Status.VALIDATED);
            bet.setWinningOption(winningOption);
            betRepository.save(bet);
            log.info("  ✓ Bet {} (group '{}') → VALIDATED ({} participant(s))",
                    bet.getId(), groupName, participations.size());
        }
    }

    /**
     * Force-recalculates points for a specific bet, regardless of its current status.
     * Applies only the delta vs the previously stored pointsEarned to avoid double-counting.
     * Use for data recovery when a group's bet was settled with wrong/missing points.
     */
    @Transactional
    public void forceSettleBet(Long matchId, Long betId) {
        Match match = requireMatch(matchId);
        if (match.getStatus() != Match.Status.FINISHED) {
            throw new IllegalStateException("Match is not FINISHED");
        }

        Bet bet = betRepository.findById(betId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Bet not found: " + betId));
        if (!bet.getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Bet " + betId + " does not belong to match " + matchId);
        }

        String winningOption = computeWinningOption(match);
        log.info("🔧 Force-settling bet {} (group '{}', match {}) — winning option: {}",
                betId, bet.getGroup().getName(), matchId, winningOption);

        List<BetParticipation> participations = betParticipationRepository.findByBetId(betId);
        for (BetParticipation p : participations) {
            int shouldBe = computeEarnedPoints(p.getChosenOption().trim(), winningOption);
            int delta = shouldBe - p.getPointsEarned();
            if (delta != 0) {
                User user = p.getUser();
                user.setGlobalScore(user.getGlobalScore() + delta);
                // Credit betsWon only if this participation wasn't already counted
                if (shouldBe > 0 && p.getPointsEarned() == 0) {
                    user.setBetsWon(user.getBetsWon() + 1);
                }
                userRepository.save(user);
                p.setPointsEarned(shouldBe);
                betParticipationRepository.save(p);
                log.info("  {} → {} pts (delta {})", user.getUsername(), shouldBe, delta > 0 ? "+" + delta : delta);
            } else {
                log.info("  {} → {} pts (no change)", p.getUser().getUsername(), shouldBe);
            }
        }

        bet.setStatus(Bet.Status.VALIDATED);
        bet.setWinningOption(winningOption);
        betRepository.save(bet);
        log.info("  ✓ Bet {} → VALIDATED ({} participant(s))", betId, participations.size());
    }

    /**
     * Points for a single participation:
     * +5 exact score | +3 correct result | 0 wrong
     */
    int computeEarnedPoints(String chosenOption, String winningOption) {
        if (chosenOption.equals(winningOption)) return POINTS_EXACT_SCORE;
        if (extractResult(chosenOption).equals(extractResult(winningOption))) return POINTS_CORRECT_RESULT;
        return 0;
    }

    /** "Victoire France 2-1" → "Victoire France" | "Match nul 1-1" → "Match nul" */
    private String extractResult(String option) {
        if (option.startsWith("Match nul")) return "Match nul";
        if (option.startsWith("Victoire ")) {
            int lastSpace = option.lastIndexOf(' ');
            if (lastSpace > 0) return option.substring(0, lastSpace);
        }
        return option;
    }

    /** Winner's score always first. France 0–1 Sénégal → "Victoire Sénégal 1-0" */
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
