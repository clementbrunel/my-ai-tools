package com.pronocore.service;

import com.pronocore.dto.request.CreateMatchRequest;
import com.pronocore.dto.request.UpdateMatchScoreRequest;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.*;
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
    @Mock private UserRepository             userRepository;
    @Mock private UserForfeitRepository      userForfeitRepository;
    @Mock private DailyGageService           dailyGageService;

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

    // ── settlement triggered by updateMatchScore ───────────────────────────────

    /**
     * France 2-1 Brésil.
     *
     * Three participants:
     *   exactUser   → "Victoire France 2-1"  → +5 pts, betsWon++
     *   correctUser → "Victoire France 3-0"  → +3 pts, betsWon unchanged
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

        // Points
        assertThat(exactUser.getGlobalScore()).isEqualTo(15);   // 10 + 5
        assertThat(correctUser.getGlobalScore()).isEqualTo(13); // 10 + 3
        assertThat(wrongUser.getGlobalScore()).isEqualTo(10);   // no change

        // betsWon incremented for any positive result (+3 or +5)
        assertThat(exactUser.getBetsWon()).isEqualTo(1);
        assertThat(correctUser.getBetsWon()).isEqualTo(1);
        assertThat(wrongUser.getBetsWon()).isEqualTo(0);

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

    // ── helpers ───────────────────────────────────────────────────────────────

    private User user(Long id, String username, int score) {
        return User.builder()
                .id(id).username(username)
                .globalScore(score).betsWon(0).forfeitsReceived(0)
                .build();
    }

    private BetParticipation participation(Long id, User user, String option) {
        return BetParticipation.builder()
                .id(id).user(user).chosenOption(option)
                .build();
    }
}
