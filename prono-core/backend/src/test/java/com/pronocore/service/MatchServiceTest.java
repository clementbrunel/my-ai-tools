package com.pronocore.service;

import com.pronocore.dto.request.CreateMatchRequest;
import com.pronocore.dto.request.UpdateMatchScoreRequest;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.*;
import com.pronocore.entity.Group;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock private MatchRepository            matchRepository;
    @Mock private MatchMapper                matchMapper;
    @Mock private BetRepository              betRepository;
    @Mock private BetParticipationRepository betParticipationRepository;
    @Mock private GroupMemberRepository      groupMemberRepository;
    @Mock private UserRepository             userRepository;
    @Mock private TeamRepository             teamRepository;
    @Mock private DailyGageService           dailyGageService;
    @Mock private CompetitionService         competitionService;

    @InjectMocks
    private MatchService matchService;

    /**
     * Some code paths (autoCreateBet, gage draw) read the authenticated username.
     * We provide a lenient stub so it doesn't blow up in tests that don't exercise
     * those paths, without generating "unnecessary stubbing" warnings.
     */
    @BeforeEach
    void setUpSecurityContext() {
        SecurityContext sc   = mock(SecurityContext.class);
        Authentication  auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("admin");
        lenient().when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── computeEarnedPoints (package-private — directly testable) ─────────────

    @Test
    void computeEarnedPoints_shouldReturn5ForExactScore() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France 2-1", "Victoire France 2-1"))
                .isEqualTo(5);
    }

    @Test
    void computeEarnedPoints_shouldReturn3ForCorrectWinnerWrongScore() {
        // Right winner, wrong score → correct result only
        assertThat(matchService.computeEarnedPoints(
                "Victoire France 3-0", "Victoire France 2-1"))
                .isEqualTo(3);
    }

    @Test
    void computeEarnedPoints_shouldReturn3ForCorrectDrawWrongScore() {
        // Predicted draw at 0-0, actual draw at 1-1 → correct result
        assertThat(matchService.computeEarnedPoints(
                "Match nul 0-0", "Match nul 1-1"))
                .isEqualTo(3);
    }

    @Test
    void computeEarnedPoints_shouldReturn0ForWrongWinner() {
        // Predicted France wins, Brésil actually wins
        assertThat(matchService.computeEarnedPoints(
                "Victoire France 2-0", "Victoire Brésil 1-0"))
                .isEqualTo(0);
    }

    @Test
    void computeEarnedPoints_shouldReturn0ForPredictedWinButActualDraw() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France 2-0", "Match nul 0-0"))
                .isEqualTo(0);
    }

    @Test
    void computeEarnedPoints_shouldReturn0ForPredictedDrawButActualWin() {
        assertThat(matchService.computeEarnedPoints(
                "Match nul 1-1", "Victoire France 2-1"))
                .isEqualTo(0);
    }

    // ── TAB (tirs au but) scoring ──────────────────────────────────────────────

    @Test
    void computeEarnedPoints_tab_exactWithPenScore_shouldReturn7() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 1-1 (5-4)", "Victoire France t.a.b. 1-1 (5-4)"))
                .isEqualTo(7);
    }

    @Test
    void computeEarnedPoints_tab_rightWinnerRightModeNoScore_shouldReturn5() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 1-1", "Victoire France t.a.b. 1-1 (5-4)"))
                .isEqualTo(5);
    }

    @Test
    void computeEarnedPoints_tab_rightWinnerRightModeWrongScore_shouldReturn5() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 0-0", "Victoire France t.a.b. 1-1 (5-4)"))
                .isEqualTo(5);
    }

    @Test
    void computeEarnedPoints_tab_rightWinnerWrongPenScore_shouldReturn5() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 1-1 (4-5)", "Victoire France t.a.b. 1-1 (5-4)"))
                .isEqualTo(5);
    }

    @Test
    void computeEarnedPoints_tab_rightWinnerWrongMode_shouldReturn3() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire France 2-1", "Victoire France t.a.b. 1-1"))
                .isEqualTo(3);
    }

    @Test
    void computeEarnedPoints_predictedTab_actualNormalWin_shouldReturn3() {
        // Predicted TAB win, but match was decided in normal time → still correct winner → +3
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 1-1", "Victoire France 2-1"))
                .isEqualTo(3);
    }

    @Test
    void computeEarnedPoints_tab_wrongWinner_shouldReturn0() {
        assertThat(matchService.computeEarnedPoints(
                "Victoire Angleterre t.a.b. 1-1", "Victoire France t.a.b. 1-1"))
                .isEqualTo(0);
    }

    @Test
    void computeEarnedPoints_tab_exactWithoutPenScore_shouldReturn5() {
        // No pen score stored in winning option → max is +5
        assertThat(matchService.computeEarnedPoints(
                "Victoire France t.a.b. 1-1", "Victoire France t.a.b. 1-1"))
                .isEqualTo(5);
    }

    // ── settlement triggered by updateMatchScore ───────────────────────────────

    /**
     * France 2-1 Brésil.
     *
     * Three participants:
     *   exactUser   → "Victoire France 2-1"  → +5 pts
     *   correctUser → "Victoire France 3-0"  → +3 pts
     *   wrongUser   → "Match nul 0-0"        → +0 pts
     *
     * Winner option format: winner's score always first
     * → "Victoire France 2-1" (NOT "2-1" from B's perspective).
     */
    @Test
    void settlement_shouldAwardCorrectPointsWhenMatchTransitionsToFinished() {
        Match match = Match.builder()
                .id(1L).teamA("France").teamB("Brésil")
                .matchDate(LocalDateTime.now().minusHours(2))
                .status(Match.Status.ONGOING)   // not yet FINISHED
                .build();                        // no forfeit → gage block skipped

        UpdateMatchScoreRequest req = new UpdateMatchScoreRequest();
        req.setScoreA(2);
        req.setScoreB(1);
        req.setStatus(Match.Status.FINISHED);

        User exactUser   = user(1L, "exact",   10);
        User correctUser = user(2L, "correct", 10);
        User wrongUser   = user(3L, "wrong",   10);

        Bet bet = Bet.builder().id(10L).status(Bet.Status.OPEN).points(10).build();

        when(matchRepository.findById(1L)).thenReturn(Optional.of(match));
        // Return the mutated match so computeWinningOption sees scoreA=2, scoreB=1
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(1L, Bet.Status.OPEN))
                .thenReturn(List.of(bet));
        when(betParticipationRepository.findByBetId(10L)).thenReturn(List.of(
                participation(1L, exactUser,   "Victoire France 2-1"),
                participation(2L, correctUser, "Victoire France 3-0"),
                participation(3L, wrongUser,   "Match nul 0-0")
        ));
        when(matchMapper.toResponse(any(Match.class))).thenReturn(MatchResponse.builder().build());

        matchService.updateMatchScore(1L, req);

        // Winning option recorded on the bet
        assertThat(bet.getStatus()).isEqualTo(Bet.Status.VALIDATED);
        assertThat(bet.getWinningOption()).isEqualTo("Victoire France 2-1");
    }

    /**
     * The winning option must put the winner's score first regardless of team order.
     * France (teamA) loses 0-1 → "Victoire Brésil 1-0", NOT "Victoire Brésil 0-1".
     */
    @Test
    void settlement_winningOption_shouldPutWinnerScoreFirst_whenTeamBWins() {
        Match match = Match.builder()
                .id(2L).teamA("France").teamB("Brésil")
                .matchDate(LocalDateTime.now().minusHours(1))
                .status(Match.Status.ONGOING)
                .build();

        UpdateMatchScoreRequest req = new UpdateMatchScoreRequest();
        req.setScoreA(0); // France (teamA) scored 0
        req.setScoreB(1); // Brésil (teamB) scored 1 → Brésil wins
        req.setStatus(Match.Status.FINISHED);

        Bet bet = Bet.builder().id(20L).status(Bet.Status.OPEN).points(10).build();

        when(matchRepository.findById(2L)).thenReturn(Optional.of(match));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(2L, Bet.Status.OPEN))
                .thenReturn(List.of(bet));
        when(betParticipationRepository.findByBetId(20L)).thenReturn(List.of());
        when(matchMapper.toResponse(any(Match.class))).thenReturn(MatchResponse.builder().build());

        matchService.updateMatchScore(2L, req);

        // Winner's score (1) must come before loser's score (0)
        assertThat(bet.getWinningOption()).isEqualTo("Victoire Brésil 1-0");
    }

    @Test
    void settlement_shouldNotTriggerWhenMatchWasAlreadyFinished() {
        // Match is ALREADY FINISHED → no transition → no settlement
        Match alreadyFinished = Match.builder()
                .id(3L).teamA("France").teamB("Brésil")
                .status(Match.Status.FINISHED)
                .build();

        UpdateMatchScoreRequest req = new UpdateMatchScoreRequest();
        req.setScoreA(2);
        req.setScoreB(1);
        req.setStatus(Match.Status.FINISHED);

        when(matchRepository.findById(3L)).thenReturn(Optional.of(alreadyFinished));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(matchMapper.toResponse(any(Match.class))).thenReturn(MatchResponse.builder().build());

        matchService.updateMatchScore(3L, req);

        // Settlement repositories must never be touched
        verifyNoInteractions(betRepository, betParticipationRepository);
    }

    // ── createMatch ───────────────────────────────────────────────────────────

    /**
     * A match is global and starts CLOSED to betting: createMatch must NOT
     * create any bet. Each group's admin opens it later via
     * BetService.openMatchForBetting.
     */
    @Test
    void createMatch_shouldNotCreateAnyBet() {
        LocalDateTime matchDate = LocalDateTime.of(2026, 6, 14, 20, 0);

        CreateMatchRequest req = new CreateMatchRequest();
        req.setTeamA("France");
        req.setTeamB("Brésil");
        req.setMatchDate(matchDate);

        Match savedMatch = Match.builder()
                .id(1L).teamA("France").teamB("Brésil").matchDate(matchDate)
                .competition("FIFA World Cup 2026").round("Group Stage")
                .status(Match.Status.UPCOMING).build();

        when(matchRepository.save(any(Match.class))).thenReturn(savedMatch);
        when(matchMapper.toResponse(any(Match.class))).thenReturn(MatchResponse.builder().build());

        matchService.createMatch(req);

        verifyNoInteractions(betRepository);
    }

    // ── deleteMatch ───────────────────────────────────────────────────────────

    @Test
    void deleteMatch_shouldThrowWhenMatchNotFound() {
        when(matchRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> matchService.deleteMatch(99L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("99");
    }

    // ── forceSettleBet ────────────────────────────────────────────────────────

    /**
     * The main data-recovery scenario: participation was previously stored with
     * pointsEarned=0 (bet skipped or bad state). forceSettleBet must apply the
     * delta without double-counting.
     */
    @Test
    void forceSettleBet_shouldCorrectPointsWhenParticipationHadZero() {
        Match match = finishedMatch(1L, "France", "Brésil", 2, 1);
        Bet   bet   = validatedBet(10L, match);

        User user = user(1L, "alice", 0);
        BetParticipation p = participation(1L, user, "Victoire France 3-0", 0); // missed: should be 3

        stubForceSettle(match, bet, List.of(p));

        matchService.forceSettleBet(1L, 10L);

        assertThat(p.getPointsEarned()).isEqualTo(3);
        verify(betParticipationRepository).save(p);
    }

    /**
     * Idempotency: if the participation already has the correct points,
     * forceSettleBet must not double-count points.
     */
    @Test
    void forceSettleBet_shouldNotDoubleCountIfAlreadyCorrect() {
        Match match = finishedMatch(1L, "France", "Brésil", 2, 1);
        Bet   bet   = validatedBet(10L, match);

        User user = user(1L, "alice", 13);  // already has 3 pts from this bet
        BetParticipation p = participation(1L, user, "Victoire France 3-0", 3); // already correct

        stubForceSettle(match, bet, List.of(p));

        matchService.forceSettleBet(1L, 10L);

        verifyNoInteractions(userRepository);
        verify(betParticipationRepository, never()).save(any());
    }

    /**
     * A participant who predicted the wrong result keeps 0 pts — no score change.
     */
    @Test
    void forceSettleBet_shouldKeepZeroForWrongPrediction() {
        Match match = finishedMatch(1L, "France", "Brésil", 2, 1);
        Bet   bet   = openBet(10L, match);

        User user = user(1L, "bob", 5);
        BetParticipation p = participation(1L, user, "Match nul 0-0", 0); // wrong

        stubForceSettle(match, bet, List.of(p));

        matchService.forceSettleBet(1L, 10L);

        verifyNoInteractions(userRepository);
    }

    /**
     * Three participants: one already correct (+5), one missed (+0 → +3), one wrong (+0 stays).
     * Only the missed one must be updated.
     */
    @Test
    void forceSettleBet_shouldOnlyUpdateParticipantsWithWrongPoints() {
        Match match = finishedMatch(1L, "France", "Brésil", 2, 1);
        Bet   bet   = validatedBet(10L, match);

        User exactUser   = user(1L, "exact",   15); // already correct: +5 credited
        User correctUser = user(2L, "correct", 10); // missed: +3 not credited
        User wrongUser   = user(3L, "wrong",   10); // wrong prediction: 0 correct

        BetParticipation pExact   = participation(1L, exactUser,   "Victoire France 2-1", 5); // correct
        BetParticipation pCorrect = participation(2L, correctUser, "Victoire France 3-0", 0); // missed
        BetParticipation pWrong   = participation(3L, wrongUser,   "Match nul 0-0",       0); // correct(0)

        stubForceSettle(match, bet, List.of(pExact, pCorrect, pWrong));

        matchService.forceSettleBet(1L, 10L);

        verify(userRepository, never()).save(any());
    }

    /**
     * The main catch-up scenario: alice is an active member of group B but never submitted
     * her prediction there due to the single-group bug. She did submit in group A for the
     * same match. forceSettleBet must backfill her participation from group A into group B
     * and then award her the correct points.
     */
    @Test
    void forceSettleBet_backfillsMissingParticipationFromOtherGroupBet() {
        Match match  = finishedMatch(1L, "France", "Brésil", 2, 1);
        Group groupA = Group.builder().id(1L).name("Group A").build();
        Group groupB = Group.builder().id(2L).name("Group B").build();
        Bet   betA   = Bet.builder().id(10L).status(Bet.Status.VALIDATED).match(match).group(groupA).build();
        Bet   betB   = Bet.builder().id(20L).status(Bet.Status.OPEN).match(match).group(groupB).build();

        User alice = user(1L, "alice", 0);
        BetParticipation aliceInA = BetParticipation.builder()
                .id(1L).bet(betA).user(alice).chosenOption("Victoire France 2-1").pointsEarned(5).build();
        BetParticipation backfilled = BetParticipation.builder()
                .id(99L).bet(betB).user(alice).chosenOption("Victoire France 2-1").pointsEarned(0).build();

        GroupMember aliceInB = GroupMember.builder()
                .id(1L).group(groupB).user(alice)
                .role(GroupMember.GroupRole.MEMBER).status(GroupMember.MemberStatus.ACTIVE).build();

        when(matchRepository.findById(1L)).thenReturn(Optional.of(match));
        when(betRepository.findById(20L)).thenReturn(Optional.of(betB));
        when(groupMemberRepository.findByGroupIdAndStatus(2L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(aliceInB));
        when(betParticipationRepository.existsByBetIdAndUserId(20L, 1L)).thenReturn(false);
        when(betParticipationRepository.findByUserIdAndMatchId(1L, 1L)).thenReturn(List.of(aliceInA));
        when(betParticipationRepository.save(any(BetParticipation.class))).thenReturn(backfilled);
        when(betParticipationRepository.findByBetId(20L)).thenReturn(List.of(backfilled));

        matchService.forceSettleBet(1L, 20L);

        // backfill save + points correction save
        verify(betParticipationRepository, times(2)).save(any(BetParticipation.class));
        assertThat(backfilled.getPointsEarned()).isEqualTo(5);
    }

    @Test
    void forceSettleBet_doesNotBackfillWhenUserHasNoParticipationInAnyOtherBet() {
        Match match  = finishedMatch(1L, "France", "Brésil", 2, 1);
        Group groupB = Group.builder().id(2L).name("Group B").build();
        Bet   betB   = Bet.builder().id(20L).status(Bet.Status.OPEN).match(match).group(groupB).build();

        User alice = user(1L, "alice", 0);
        GroupMember aliceInB = GroupMember.builder()
                .id(1L).group(groupB).user(alice)
                .role(GroupMember.GroupRole.MEMBER).status(GroupMember.MemberStatus.ACTIVE).build();

        when(matchRepository.findById(1L)).thenReturn(Optional.of(match));
        when(betRepository.findById(20L)).thenReturn(Optional.of(betB));
        when(groupMemberRepository.findByGroupIdAndStatus(2L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(aliceInB));
        when(betParticipationRepository.existsByBetIdAndUserId(20L, 1L)).thenReturn(false);
        when(betParticipationRepository.findByUserIdAndMatchId(1L, 1L)).thenReturn(List.of());
        when(betParticipationRepository.findByBetId(20L)).thenReturn(List.of());

        matchService.forceSettleBet(1L, 20L);

        verify(betParticipationRepository, never()).save(any(BetParticipation.class));
        verifyNoInteractions(userRepository);
    }

    @Test
    void forceSettleBet_shouldThrowWhenMatchNotFinished() {
        Match match = Match.builder()
                .id(1L).teamA("France").teamB("Brésil")
                .status(Match.Status.ONGOING)
                .build();

        when(matchRepository.findById(1L)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> matchService.forceSettleBet(1L, 10L))
                .isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(betRepository, betParticipationRepository, userRepository);
    }

    @Test
    void forceSettleBet_shouldThrowWhenBetBelongsToDifferentMatch() {
        Match match1  = finishedMatch(1L, "France", "Brésil", 2, 1);
        Match match2  = Match.builder().id(2L).build();
        Bet   betM2   = Bet.builder().id(10L)
                .match(match2).group(Group.builder().id(1L).name("G").build()).build();

        when(matchRepository.findById(1L)).thenReturn(Optional.of(match1));
        when(betRepository.findById(10L)).thenReturn(Optional.of(betM2));

        assertThatThrownBy(() -> matchService.forceSettleBet(1L, 10L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User user(Long id, String username, int score) {
        return User.builder()
                .id(id).username(username)
                .build();
    }

    /** Participation with an explicit pointsEarned value (simulating already-settled state). */
    private BetParticipation participation(Long id, User user, String option, int pointsEarned) {
        return BetParticipation.builder()
                .id(id).user(user).chosenOption(option).pointsEarned(pointsEarned)
                .build();
    }

    /** Participation with default pointsEarned=0 (not yet settled). */
    private BetParticipation participation(Long id, User user, String option) {
        return participation(id, user, option, 0);
    }

    private Match finishedMatch(Long id, String teamA, String teamB, int scoreA, int scoreB) {
        return Match.builder()
                .id(id).teamA(teamA).teamB(teamB)
                .matchDate(LocalDateTime.now().minusHours(2))
                .scoreA(scoreA).scoreB(scoreB)
                .status(Match.Status.FINISHED)
                .build();
    }

    private Bet validatedBet(Long id, Match match) {
        return Bet.builder().id(id).status(Bet.Status.VALIDATED)
                .match(match).group(Group.builder().id(1L).name("TestGroup").build()).build();
    }

    private Bet openBet(Long id, Match match) {
        return Bet.builder().id(id).status(Bet.Status.OPEN)
                .match(match).group(Group.builder().id(1L).name("TestGroup").build()).build();
    }

    private void stubForceSettle(Match match, Bet bet, List<BetParticipation> participations) {
        when(matchRepository.findById(match.getId())).thenReturn(Optional.of(match));
        when(betRepository.findById(bet.getId())).thenReturn(Optional.of(bet));
        when(betParticipationRepository.findByBetId(bet.getId())).thenReturn(participations);
    }
}
