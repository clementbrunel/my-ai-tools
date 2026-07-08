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
    private final GroupMemberRepository      groupMemberRepository;
    private final UserRepository             userRepository;
    private final TeamRepository             teamRepository;
    private final CompetitionRepository      competitionRepository;
    private final DailyGageService           dailyGageService;

    // ---------------------------------------------------------------
    // Scoring constants
    // ---------------------------------------------------------------

    static final int POINTS_GOOD_WINNER = 3;
    static final int POINTS_GOOD_SCORE  = 2;
    static final int POINTS_TAB_BONUS   = 2;

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<MatchResponse> getAllMatches() {
        return matchRepository.findAllByOrderByMatchDateAsc().stream()
                .map(this::toEnrichedResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MatchResponse> getMatchesByStatus(Match.Status status) {
        return matchRepository.findByStatusOrderByMatchDateAsc(status).stream()
                .map(this::toEnrichedResponse).toList();
    }

    @Transactional(readOnly = true)
    public MatchResponse getMatchById(Long id) {
        return toEnrichedResponse(requireMatch(id));
    }

    @Transactional(readOnly = true)
    public List<MatchResponse> getMatchesForUserGroups(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("User not found: " + username));
        List<Match> matches = betRepository.findDistinctMatchesWithBetsInUserGroups(user.getId());
        Set<Long> participatedIds = betParticipationRepository.findParticipatedMatchIdsByUserId(user.getId());
        return matches.stream()
                .map(match -> {
                    MatchResponse response = toEnrichedResponse(match);
                    response.setUserParticipated(participatedIds.contains(match.getId()));
                    return response;
                })
                .toList();
    }

    // ---------------------------------------------------------------
    // Commands
    // ---------------------------------------------------------------

    @Transactional
    public MatchResponse createMatch(CreateMatchRequest request) {
        Team teamA = teamRepository.findById(request.getTeamAId())
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + request.getTeamAId()));
        Team teamB = teamRepository.findById(request.getTeamBId())
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + request.getTeamBId()));
        Competition competition = competitionRepository.findById(request.getCompetitionId())
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + request.getCompetitionId()));
        Match match = Match.builder()
                .teamA(teamA)
                .teamB(teamB)
                .matchDate(request.getMatchDate())
                .competition(competition)
                .round(request.getRound() != null ? request.getRound() : "")
                .phase(request.getPhase() != null ? request.getPhase() : Match.MatchPhase.POOL)
                .status(Match.Status.UPCOMING)
                .build();
        match = matchRepository.save(match);
        return toEnrichedResponse(match);
    }

    @Transactional
    public MatchResponse updateMatchScore(Long id, UpdateMatchScoreRequest request) {
        Match match = requireMatch(id);

        if (request.getPenaltyWinner() != null && match.getPhase() == Match.MatchPhase.POOL) {
            throw new IllegalArgumentException("Penalty shootout cannot be set on POOL phase matches");
        }
        if (request.getPenaltyWinner() != null
                && request.getScoreA() != null && request.getScoreB() != null
                && !request.getScoreA().equals(request.getScoreB())) {
            throw new IllegalArgumentException("Penalty shootout requires equal regulation scores (scores must be tied)");
        }

        boolean transitionsToFinished =
                match.getStatus() != Match.Status.FINISHED
                        && request.getStatus() == Match.Status.FINISHED;

        match.setScoreA(request.getScoreA());
        match.setScoreB(request.getScoreB());
        match.setStatus(request.getStatus());
        match.setSyncLocked(true);
        match.setAutoSynced(false);
        if (request.getPenaltyWinner() != null) {
            match.setPenaltyWinner(request.getPenaltyWinner());
            match.setPenaltyScoreA(request.getPenaltyScoreA());
            match.setPenaltyScoreB(request.getPenaltyScoreB());
        } else if (request.isPenaltyCleared()) {
            match.setPenaltyWinner(null);
            match.setPenaltyScoreA(null);
            match.setPenaltyScoreB(null);
        }
        match = matchRepository.save(match);

        if (transitionsToFinished && request.getScoreA() != null && request.getScoreB() != null) {
            settleBetsForMatch(match);
            // After settling, check if the whole day is done → assign daily gage
            dailyGageService.onMatchSettled(match.getMatchDate().toLocalDate());
        }

        return toEnrichedResponse(match);
    }

    @Transactional
    public void deleteMatch(Long id) {
        if (!matchRepository.existsById(id)) throw new EntityNotFoundException("Match not found: " + id);
        matchRepository.deleteById(id);
    }

    public Match findById(Long id) { return requireMatch(id); }

    /**
     * Called by MatchSyncService when the external API signals a match is live or finished.
     * Does NOT set syncLocked (admin score always takes precedence if syncLocked = true).
     */
    @Transactional
    public void syncMatchScore(Long id, int scoreA, int scoreB, Match.Status newStatus) {
        Match match = requireMatch(id);
        if (match.isSyncLocked()) {
            log.debug("Match {} is sync-locked, skipping auto-sync", id);
            return;
        }

        boolean transitionsToFinished =
                match.getStatus() != Match.Status.FINISHED && newStatus == Match.Status.FINISHED;

        match.setScoreA(scoreA);
        match.setScoreB(scoreB);
        match.setStatus(newStatus);
        match.setAutoSynced(true);
        match = matchRepository.save(match);

        if (transitionsToFinished) {
            settleBetsForMatch(match);
            dailyGageService.onMatchSettled(match.getMatchDate().toLocalDate());
        }
    }

    // ---------------------------------------------------------------
    // Settlement logic
    // ---------------------------------------------------------------

    /**
     * When admin marks a match as FINISHED:
     * 1. Compute the winning option string.
     * 2. Award points to each participant — scoring additif: see computeEarnedPoints().
     * 3. Store pointsEarned on each participation (used by daily gage loser logic).
     *
     * Note: per-match forfeit assignment has been removed.
     * Gages are now assigned per day via DailyGageService.onMatchSettled().
     *
     * Winning-option format (winner's score always first):
     *   teamA wins 2-1          → "Victoire France 2-1"
     *   teamB wins 1-0          → "Victoire Sénégal 1-0"
     *   draw 0-0                → "Match nul 0-0"
     *   TAB France wins (5-4)   → "Victoire France t.a.b. 1-1 (5-4)"
     */
    private void settleBetsForMatch(Match match) {
        String winningOption = computeWinningOption(match);
        log.info("⚽ Settling match {} ({} vs {}) — winning option: {}",
                match.getId(), match.getTeamA().getName(), match.getTeamB().getName(), winningOption);

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
     * Force-recalculates points for ALL bets of a match, regardless of status.
     * Safe to call multiple times — applies only the delta to avoid double-counting.
     */
    @Transactional
    public void forceSettleMatch(Long matchId) {
        Match match = requireMatch(matchId);
        if (match.getStatus() != Match.Status.FINISHED) {
            throw new IllegalStateException("Match is not FINISHED");
        }
        List<Bet> bets = betRepository.findByMatchIdOrderByCreatedAtDesc(matchId);
        log.info("🔧 Force-settling all {} bet(s) for match {} ({} vs {})",
                bets.size(), matchId, match.getTeamA().getName(), match.getTeamB().getName());
        for (Bet bet : bets) {
            forceSettleBet(matchId, bet.getId());
        }
        log.info("  ✓ Done — {} bet(s) processed", bets.size());
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

        backfillMissingParticipations(bet, match);

        List<BetParticipation> participations = betParticipationRepository.findByBetId(betId);
        for (BetParticipation p : participations) {
            int shouldBe = computeEarnedPoints(p.getChosenOption().trim(), winningOption);
            int delta = shouldBe - p.getPointsEarned();
            if (delta != 0) {
                p.setPointsEarned(shouldBe);
                betParticipationRepository.save(p);
                log.info("  {} → {} pts (delta {})", p.getUser().getUsername(), shouldBe, delta > 0 ? "+" + delta : delta);
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
     * For each active member of the bet's group who has no participation in this bet,
     * look for their prediction in another bet for the same match and copy it.
     * This recovers participations that were missed due to the single-group submission bug.
     */
    private void backfillMissingParticipations(Bet bet, Match match) {
        List<GroupMember> activeMembers = groupMemberRepository
                .findByGroupIdAndStatus(bet.getGroup().getId(), GroupMember.MemberStatus.ACTIVE);

        for (GroupMember member : activeMembers) {
            Long userId = member.getUser().getId();
            if (betParticipationRepository.existsByBetIdAndUserId(bet.getId(), userId)) {
                continue;
            }
            betParticipationRepository.findByUserIdAndMatchId(userId, match.getId()).stream()
                    .filter(p -> !p.getBet().getId().equals(bet.getId()))
                    .findFirst()
                    .ifPresent(source -> {
                        BetParticipation backfilled = BetParticipation.builder()
                                .bet(bet)
                                .user(member.getUser())
                                .chosenOption(source.getChosenOption())
                                .comment(source.getComment())
                                .build();
                        betParticipationRepository.save(backfilled);
                        log.info("  ↩ Backfilled participation for {} in group '{}' (copied from group '{}')",
                                member.getUser().getUsername(),
                                bet.getGroup().getName(),
                                source.getBet().getGroup().getName());
                    });
        }
    }

    /**
     * Points for a single participation — scoring additif GOOD_WINNER(3) + GOOD_SCORE(2) + TAB_BONUS(2).
     *
     * Normal :  GOOD_WINNER + GOOD_SCORE = 5  (exact)
     *           GOOD_WINNER             = 3  (bon gagnant, mauvais score)
     *           0                            (mauvais gagnant)
     *
     * TAB :     GOOD_WINNER + GOOD_SCORE + TAB_BONUS = 7  (exact + bon score pénalty)
     *           GOOD_WINNER + GOOD_SCORE             = 5  (bon gagnant + bon score rég)
     *           GOOD_WINNER                          = 3  (bon gagnant, mauvais score rég)
     *           GOOD_SCORE                           = 2  (mauvais gagnant, bon score rég)
     *           0                                         (mauvais gagnant, mauvais score rég)
     */
    int computeEarnedPoints(String chosenOption, String winningOption) {
        String c = chosenOption.trim();
        String w = winningOption.trim();
        boolean winningIsTab = w.contains(" t.a.b. ");
        if (winningIsTab) {
            boolean winningHasPenScore = w.matches(".*\\(\\d+-\\d+\\)$");
            if (c.equals(w) && winningHasPenScore) return POINTS_GOOD_WINNER + POINTS_GOOD_SCORE + POINTS_TAB_BONUS;
            String wReg = extractRegulationScore(w);
            boolean sameWinner   = extractResult(c).equals(extractResult(w));
            boolean sameRegScore = !wReg.isEmpty() && wReg.equals(extractRegulationScore(c));
            if (sameWinner && sameRegScore) return POINTS_GOOD_WINNER + POINTS_GOOD_SCORE;
            if (sameWinner)                 return POINTS_GOOD_WINNER;
            if (sameRegScore)               return POINTS_GOOD_SCORE;
            return 0;
        }
        if (c.equals(w)) return POINTS_GOOD_WINNER + POINTS_GOOD_SCORE;
        if (extractResult(c).equals(extractResult(w))) return POINTS_GOOD_WINNER;
        return 0;
    }

    /**
     * Strips score and t.a.b. marker — used to compare winners regardless of mode.
     * "Victoire France t.a.b. 1-1 (5-4)" → "Victoire France"
     * "Victoire France 2-1"               → "Victoire France"
     * "Match nul 1-1"                     → "Match nul"
     */
    private String extractResult(String option) {
        String s = option.replaceAll("\\s*\\(\\d+-\\d+\\)$", "");
        s = s.replace(" t.a.b.", "");
        if (s.startsWith("Match nul")) return "Match nul";
        if (s.startsWith("Victoire ")) {
            int lastSpace = s.lastIndexOf(' ');
            if (lastSpace > 0) return s.substring(0, lastSpace);
        }
        return option;
    }

    /**
     * Extracts the regulation score (last "X-Y" token after stripping penalty suffix).
     * "Victoire France t.a.b. 1-1 (5-4)" → "1-1"
     * "Victoire France t.a.b. 0-0"        → "0-0"
     * "Victoire France 2-1"               → "2-1"
     * "Victoire France"                   → ""
     */
    private String extractRegulationScore(String option) {
        String s = option.replaceAll("\\s*\\(\\d+-\\d+\\)$", "");
        int i = s.lastIndexOf(' ');
        if (i < 0) return "";
        String tail = s.substring(i + 1);
        return tail.matches("\\d+-\\d+") ? tail : "";
    }

    /**
     * Winner's score always first.
     * France 0–1 Sénégal → "Victoire Sénégal 1-0"
     * TAB (France wins, pen 5-4, draw 1-1) → "Victoire France t.a.b. 1-1 (5-4)"
     * TAB without pen score stored → "Victoire France t.a.b. 1-1"
     */
    private String computeWinningOption(Match match) {
        if (match.getScoreA() == null || match.getScoreB() == null) {
            throw new IllegalStateException("Cannot compute winning option: scores are null for match " + match.getId());
        }
        int sA = match.getScoreA(), sB = match.getScoreB();
        if (match.getPenaltyWinner() != null) {
            String winner;
            String penScore = "";
            if (match.getPenaltyWinner().equals("A")) {
                winner = match.getTeamA().getName();
                if (match.getPenaltyScoreA() != null && match.getPenaltyScoreB() != null)
                    penScore = " (" + match.getPenaltyScoreA() + "-" + match.getPenaltyScoreB() + ")";
            } else {
                winner = match.getTeamB().getName();
                if (match.getPenaltyScoreA() != null && match.getPenaltyScoreB() != null)
                    penScore = " (" + match.getPenaltyScoreB() + "-" + match.getPenaltyScoreA() + ")";
            }
            return "Victoire " + winner + " t.a.b. " + sA + "-" + sB + penScore;
        }
        if (sA > sB) return "Victoire " + match.getTeamA().getName() + " " + sA + "-" + sB;
        if (sB > sA) return "Victoire " + match.getTeamB().getName() + " " + sB + "-" + sA;
        return "Match nul " + sA + "-" + sB;
    }

    private Match requireMatch(Long id) {
        return matchRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Match not found: " + id));
    }

    private MatchResponse toEnrichedResponse(Match match) {
        return matchMapper.toResponse(match);
    }
}
