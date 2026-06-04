package com.pronocore.service;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.entity.*;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DailyGageServiceTest {

    @Mock private DailyGageRepository          dailyGageRepository;
    @Mock private DailyGageCandidateRepository candidateRepository;
    @Mock private DailyGageVoteRepository      voteRepository;
    @Mock private ForfeitRepository            forfeitRepository;
    @Mock private UserRepository               userRepository;
    @Mock private UserForfeitRepository        userForfeitRepository;
    @Mock private BetParticipationRepository   betParticipationRepository;
    @Mock private MatchRepository              matchRepository;

    @InjectMocks
    private DailyGageService dailyGageService;

    private static final LocalDate MATCH_DAY = LocalDate.of(2026, 6, 11);

    private User adminUser;
    private Match sampleMatch;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@test.com")
                .password("encoded")
                .role(User.Role.ADMIN)
                .globalScore(0)
                .betsWon(0)
                .forfeitsReceived(0)
                .build();

        sampleMatch = Match.builder()
                .id(1L)
                .teamA("France")
                .teamB("Brésil")
                .matchDate(MATCH_DAY.atTime(20, 0))
                .status(Match.Status.UPCOMING)
                .competition("FIFA World Cup 2026")
                .round("Group Stage")
                .build();

        // Security context — needed by currentUsername() called in toResponse()
        SecurityContext sc   = mock(SecurityContext.class);
        Authentication  auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("admin");
        lenient().when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);

        // needed by toResponse() when building candidate / gage responses
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── createDailyGage: no match on that day ─────────────────────────────────

    @Test
    void createDailyGage_shouldThrow_whenNoMatchExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        // MatchRepository returns an empty list → no matches scheduled
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Aucun match prévu");

        verify(dailyGageRepository, never()).save(any());
    }

    // ── createDailyGage: happy path ───────────────────────────────────────────

    @Test
    void createDailyGage_shouldCreate_whenAtLeastOneMatchExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        DailyGage saved = DailyGage.builder()
                .id(10L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(sampleMatch));
        when(dailyGageRepository.save(any(DailyGage.class))).thenReturn(saved);
        // toResponse() looks up the current user to compute userVote on candidates
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        DailyGageResponse result = dailyGageService.createDailyGage(req);

        assertThat(result).isNotNull();
        assertThat(result.getMatchDate()).isEqualTo(MATCH_DAY);
        assertThat(result.getMode()).isEqualTo("DIRECT");
        assertThat(result.getStatus()).isEqualTo("PENDING");
        assertThat(result.getCandidates()).isEmpty();
        verify(dailyGageRepository).save(any(DailyGage.class));
    }

    @Test
    void createDailyGage_shouldCreate_inVoteMode_whenMatchExists() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.VOTE);

        DailyGage saved = DailyGage.builder()
                .id(11L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();

        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());
        when(matchRepository.findByMatchDay(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(sampleMatch));
        when(dailyGageRepository.save(any(DailyGage.class))).thenReturn(saved);
        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        DailyGageResponse result = dailyGageService.createDailyGage(req);

        assertThat(result.getMode()).isEqualTo("VOTE");
        verify(dailyGageRepository).save(any(DailyGage.class));
    }

    // ── createDailyGage: duplicate gage for same day ──────────────────────────

    @Test
    void createDailyGage_shouldThrow_whenGageAlreadyExistsForThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        DailyGage existing = DailyGage.builder()
                .id(99L)
                .matchDate(MATCH_DAY)
                .mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING)
                .candidates(List.of())
                .build();
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already exists");

        verify(matchRepository, never()).findByMatchDay(any(), any());
        verify(dailyGageRepository, never()).save(any());
    }

    // ── selectForfeitDirectly ─────────────────────────────────────────────────

    @Test
    void selectForfeitDirectly_shouldSetForfeitAndActivateGage() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(forfeitRepository.findById(1L)).thenReturn(Optional.of(forfeit));
        when(dailyGageRepository.save(dg)).thenReturn(dg);

        DailyGageResponse result = dailyGageService.selectForfeitDirectly(1L, 1L);

        assertThat(dg.getForfeit()).isEqualTo(forfeit);
        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.ACTIVE);
        verify(dailyGageRepository).save(dg);
    }

    @Test
    void selectForfeitDirectly_shouldThrowWhenGageIsAlreadySettled() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.SETTLED).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.selectForfeitDirectly(1L, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
        verify(dailyGageRepository, never()).save(any());
    }

    // ── addCandidate ──────────────────────────────────────────────────────────

    @Test
    void addCandidate_shouldActivatePendingGageWhenFirstCandidateIsAdded() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.PENDING).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.empty());
        when(forfeitRepository.findById(1L)).thenReturn(Optional.of(forfeit));
        when(candidateRepository.save(any(DailyGageCandidate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(dailyGageRepository.save(dg)).thenReturn(dg);

        dailyGageService.addCandidate(1L, 1L);

        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.ACTIVE);
        verify(candidateRepository).save(any(DailyGageCandidate.class));
        verify(dailyGageRepository).save(dg);
    }

    @Test
    void addCandidate_shouldThrowWhenForfeitAlreadyACandidate() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGageCandidate existing = DailyGageCandidate.builder().id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>(List.of(existing)))
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> dailyGageService.addCandidate(1L, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already a candidate");
    }

    @Test
    void addCandidate_shouldThrowWhenGageIsAlreadySettled() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.SETTLED).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.addCandidate(1L, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
        verify(candidateRepository, never()).save(any());
    }

    // ── removeCandidate ───────────────────────────────────────────────────────

    @Test
    void removeCandidate_shouldDeleteExistingCandidate() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGageCandidate candidate = DailyGageCandidate.builder()
                .id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(candidate));

        dailyGageService.removeCandidate(1L, 1L);

        verify(candidateRepository).delete(candidate);
    }

    @Test
    void removeCandidate_shouldThrowWhenCandidateNotFound() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dailyGageService.removeCandidate(1L, 99L))
                .isInstanceOf(EntityNotFoundException.class);
    }

    // ── vote ──────────────────────────────────────────────────────────────────

    @Test
    void vote_shouldThrowWhenGageIsAlreadySettled() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.SETTLED).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.vote(1L, 1L, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
    }

    @Test
    void vote_shouldThrowWhenGageIsNotInVoteMode() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>())
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.vote(1L, 1L, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not in VOTE mode");
    }

    @Test
    void vote_shouldCreateNewVoteWhenNoneExists() {
        Forfeit forfeit = buildForfeit(1L, "Karaoke");
        DailyGageCandidate candidate = DailyGageCandidate.builder()
                .id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>(List.of(candidate)))
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(candidate));
        when(voteRepository.findByCandidateIdAndUserId(5L, 1L)).thenReturn(Optional.empty());
        when(voteRepository.save(any(DailyGageVote.class))).thenAnswer(inv -> inv.getArgument(0));

        dailyGageService.vote(1L, 1L, 1);

        ArgumentCaptor<DailyGageVote> captor = ArgumentCaptor.forClass(DailyGageVote.class);
        verify(voteRepository).save(captor.capture());
        assertThat(captor.getValue().getVote()).isEqualTo(1);
        assertThat(captor.getValue().getUser()).isEqualTo(adminUser);
    }

    @Test
    void vote_shouldUpdateExistingVoteInPlace() {
        Forfeit forfeit = buildForfeit(1L, "Karaoke");
        DailyGageCandidate candidate = DailyGageCandidate.builder()
                .id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>(List.of(candidate)))
                .build();

        DailyGageVote existingVote = DailyGageVote.builder()
                .id(20L).candidate(candidate).user(adminUser).vote(1)
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(candidate));
        when(voteRepository.findByCandidateIdAndUserId(5L, 1L)).thenReturn(Optional.of(existingVote));
        when(voteRepository.save(existingVote)).thenReturn(existingVote);

        dailyGageService.vote(1L, 1L, -1);

        assertThat(existingVote.getVote()).isEqualTo(-1);
        verify(voteRepository).save(existingVote);
    }

    @Test
    void vote_shouldRemoveExistingVoteWhenValueIsZero() {
        Forfeit forfeit = buildForfeit(1L, "Karaoke");
        DailyGageCandidate candidate = DailyGageCandidate.builder()
                .id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).candidates(new ArrayList<>(List.of(candidate)))
                .build();

        DailyGageVote existingVote = DailyGageVote.builder()
                .id(20L).candidate(candidate).user(adminUser).vote(1)
                .build();

        when(dailyGageRepository.findById(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(candidate));
        when(voteRepository.findByCandidateIdAndUserId(5L, 1L)).thenReturn(Optional.of(existingVote));

        dailyGageService.vote(1L, 1L, 0);

        verify(voteRepository).delete(existingVote);
        verify(voteRepository, never()).save(any());
    }

    // ── onMatchSettled ────────────────────────────────────────────────────────

    @Test
    void onMatchSettled_shouldDefer_whenUnfinishedMatchesRemain() {
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(2L);

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(dailyGageRepository, never()).findByMatchDate(any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenNoDailyGageConfigured() {
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.empty());

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDay(any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenGageAlreadySettled() {
        DailyGage settled = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.SETTLED).forfeit(buildForfeit(1L, "Pushups"))
                .candidates(new ArrayList<>()).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(settled));

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDay(any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenDirectModeHasNoForfeitSelected() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING).forfeit(null) // no forfeit selected yet
                .candidates(new ArrayList<>()).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(dg));

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDay(any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenNoSettledParticipationsExist() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.ACTIVE).forfeit(forfeit)
                .candidates(new ArrayList<>()).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(dg));
        when(betParticipationRepository.findSettledByMatchDay(any(), any(), any())).thenReturn(List.of());

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(userForfeitRepository, never()).save(any());
        verify(dailyGageRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_directMode_shouldAssignForfeitToLoserAndMarkSettled() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        User loser = User.builder()
                .id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(0).betsWon(0).forfeitsReceived(0).build();

        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.ACTIVE).forfeit(forfeit)
                .candidates(new ArrayList<>()).build();

        // Loser earned 0 pts, adminUser earned 5 pts → loser gets the gage
        BetParticipation loserPart  = BetParticipation.builder().user(loser)     .pointsEarned(0).build();
        BetParticipation winnerPart = BetParticipation.builder().user(adminUser)  .pointsEarned(5).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(dg));
        when(betParticipationRepository.findSettledByMatchDay(any(), any(), any()))
                .thenReturn(List.of(loserPart, winnerPart));
        when(userRepository.findAll()).thenReturn(List.of(adminUser, loser));

        dailyGageService.onMatchSettled(MATCH_DAY);

        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.SETTLED);
        assertThat(dg.getAssignedTo()).isEqualTo(loser);
        assertThat(dg.getAssignedAt()).isNotNull();
        assertThat(loser.getForfeitsReceived()).isEqualTo(1);

        ArgumentCaptor<UserForfeit> captor = ArgumentCaptor.forClass(UserForfeit.class);
        verify(userForfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(loser);
        assertThat(captor.getValue().getForfeit()).isEqualTo(forfeit);
        assertThat(captor.getValue().isCompleted()).isFalse();

        verify(userRepository).save(loser);
        verify(dailyGageRepository).save(dg);
    }

    @Test
    void onMatchSettled_voteMode_shouldSelectForfeitWithHighestVoteScore() {
        Forfeit forfeitA = buildForfeit(1L, "Karaoke");    // score = +2
        Forfeit forfeitB = buildForfeit(2L, "Push-ups");   // score = -1

        DailyGageVote vote1 = DailyGageVote.builder().vote(1).build();
        DailyGageVote vote2 = DailyGageVote.builder().vote(1).build();
        DailyGageVote vote3 = DailyGageVote.builder().vote(-1).build();

        DailyGageCandidate candidateA = DailyGageCandidate.builder()
                .id(1L).forfeit(forfeitA)
                .votes(new ArrayList<>(List.of(vote1, vote2))) // score +2
                .build();
        DailyGageCandidate candidateB = DailyGageCandidate.builder()
                .id(2L).forfeit(forfeitB)
                .votes(new ArrayList<>(List.of(vote3)))        // score -1
                .build();

        User loser = User.builder()
                .id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(0).betsWon(0).forfeitsReceived(0).build();

        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).forfeit(null)
                .candidates(new ArrayList<>(List.of(candidateA, candidateB))).build();

        BetParticipation loserPart = BetParticipation.builder().user(loser).pointsEarned(0).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(dg));
        when(betParticipationRepository.findSettledByMatchDay(any(), any(), any())).thenReturn(List.of(loserPart));
        when(userRepository.findAll()).thenReturn(List.of(adminUser, loser));

        dailyGageService.onMatchSettled(MATCH_DAY);

        // Forfeit with highest vote score (forfeitA, score +2) must be assigned
        assertThat(dg.getForfeit()).isEqualTo(forfeitA);
        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.SETTLED);
    }

    @Test
    void onMatchSettled_voteMode_shouldSkipWhenNoCandidates() {
        DailyGage dg = DailyGage.builder()
                .id(1L).matchDate(MATCH_DAY).mode(DailyGage.Mode.VOTE)
                .status(DailyGage.Status.ACTIVE).forfeit(null)
                .candidates(new ArrayList<>()).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(Optional.of(dg));

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDay(any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static CreateDailyGageRequest buildRequest(LocalDate date, DailyGage.Mode mode) {
        CreateDailyGageRequest req = new CreateDailyGageRequest();
        req.setMatchDate(date);
        req.setMode(mode);
        return req;
    }

    private static Forfeit buildForfeit(Long id, String title) {
        return Forfeit.builder()
                .id(id).title(title).description("desc").category("Fun")
                .active(true).timesCompleted(0)
                .build();
    }
}
