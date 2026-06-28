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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
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
    @Mock private BetRepository                betRepository;
    @Mock private MatchRepository              matchRepository;
    @Mock private GroupRepository              groupRepository;
    @Mock private GroupMemberRepository        groupMemberRepository;
    @Mock private GroupMemberGuard             groupMemberGuard;

    @InjectMocks
    private DailyGageService dailyGageService;

    private static final LocalDate MATCH_DAY = LocalDate.of(2026, 6, 11);
    private static final Long GROUP_ID = 7L;

    private User adminUser;
    private Group group;
    private Match sampleMatch;

    @BeforeEach
    void setUp() {
        adminUser = User.builder()
                .id(1L).username("admin").email("admin@test.com")
                .password("encoded").role(User.Role.PLATFORM_ADMIN)
                .build();

        group = Group.builder().id(GROUP_ID).name("Les Potes").build();

        sampleMatch = Match.builder()
                .id(1L)
                .teamA(Team.builder().id(1L).name("France").build())
                .teamB(Team.builder().id(2L).name("Brésil").build())
                .matchDate(MATCH_DAY.atTime(20, 0)).status(Match.Status.UPCOMING)
                .competition("FIFA World Cup 2026").round("Group Stage")
                .build();

        SecurityContext sc   = mock(SecurityContext.class);
        Authentication  auth = mock(Authentication.class);
        lenient().when(auth.getName()).thenReturn("admin");
        lenient().when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);

        lenient().when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        // admin is a GROUP_ADMIN of the group → passes command authorisation
        lenient().when(groupMemberGuard.requireGroupAdmin(GROUP_ID, 1L))
                .thenReturn(adminMembership(GroupMember.GroupRole.GROUP_ADMIN));
        lenient().when(groupMemberGuard.requireActiveMembership(GROUP_ID, 1L))
                .thenReturn(adminMembership(GroupMember.GroupRole.GROUP_ADMIN));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── createDailyGage ───────────────────────────────────────────────────────

    @Test
    void createDailyGage_shouldThrow_whenNoOpenBetExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
        when(dailyGageRepository.findByGroupIdAndMatchDate(GROUP_ID, MATCH_DAY)).thenReturn(Optional.empty());
        when(betRepository.existsOpenBetForGroupOnDay(eq(GROUP_ID), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Aucun pari ouvert");
        verify(dailyGageRepository, never()).save(any());
    }

    @Test
    void createDailyGage_shouldCreate_whenOpenBetExistsOnThatDay() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        DailyGage saved = DailyGage.builder()
                .id(10L).group(group).matchDate(MATCH_DAY).mode(DailyGage.Mode.DIRECT)
                .status(DailyGage.Status.PENDING).candidates(List.of()).build();

        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
        when(dailyGageRepository.findByGroupIdAndMatchDate(GROUP_ID, MATCH_DAY)).thenReturn(Optional.empty());
        when(betRepository.existsOpenBetForGroupOnDay(eq(GROUP_ID), any(), any())).thenReturn(true);
        when(dailyGageRepository.save(any(DailyGage.class))).thenReturn(saved);

        DailyGageResponse result = dailyGageService.createDailyGage(req);

        assertThat(result.getMatchDate()).isEqualTo(MATCH_DAY);
        assertThat(result.getGroupId()).isEqualTo(GROUP_ID);
        assertThat(result.getStatus()).isEqualTo("PENDING");
        verify(dailyGageRepository).save(argThat(dg -> dg.getGroup() == group));
    }

    @Test
    void createDailyGage_shouldThrow_whenGageAlreadyExistsForThatDayInGroup() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);

        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
        when(dailyGageRepository.findByGroupIdAndMatchDate(GROUP_ID, MATCH_DAY))
                .thenReturn(Optional.of(gage(99L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING)));

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already exists");
        verify(matchRepository, never()).findByMatchDay(any(), any());
        verify(dailyGageRepository, never()).save(any());
    }

    @Test
    void createDailyGage_shouldThrow_whenCallerIsNotGroupAdmin() {
        CreateDailyGageRequest req = buildRequest(MATCH_DAY, DailyGage.Mode.DIRECT);
        when(groupMemberGuard.requireGroupAdmin(GROUP_ID, 1L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> dailyGageService.createDailyGage(req))
                .isInstanceOf(AccessDeniedException.class);
        verify(dailyGageRepository, never()).save(any());
    }

    // ── selectForfeitDirectly ─────────────────────────────────────────────────

    @Test
    void selectForfeitDirectly_shouldSetForfeitAndActivateGage() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(forfeitRepository.findById(1L)).thenReturn(Optional.of(forfeit));
        when(dailyGageRepository.save(dg)).thenReturn(dg);

        dailyGageService.selectForfeitDirectly(1L, 1L);

        assertThat(dg.getForfeit()).isEqualTo(forfeit);
        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.ACTIVE);
        verify(dailyGageRepository).save(dg);
    }

    @Test
    void selectForfeitDirectly_shouldThrowWhenGageIsAlreadySettled() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.SETTLED);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.selectForfeitDirectly(1L, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
        verify(dailyGageRepository, never()).save(any());
    }

    @Test
    void selectForfeitDirectly_shouldThrowWhenCallerNotGroupAdmin() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(groupMemberGuard.requireGroupAdmin(GROUP_ID, 1L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> dailyGageService.selectForfeitDirectly(1L, 1L))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── addCandidate / removeCandidate ────────────────────────────────────────

    @Test
    void addCandidate_shouldActivatePendingGageWhenFirstCandidateIsAdded() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.PENDING);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.empty());
        when(forfeitRepository.findById(1L)).thenReturn(Optional.of(forfeit));
        when(candidateRepository.save(any(DailyGageCandidate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(dailyGageRepository.save(dg)).thenReturn(dg);

        dailyGageService.addCandidate(1L, 1L);

        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.ACTIVE);
        verify(candidateRepository).save(any(DailyGageCandidate.class));
    }

    @Test
    void addCandidate_shouldThrowWhenForfeitAlreadyACandidate() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGageCandidate existing = DailyGageCandidate.builder().id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().add(existing);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> dailyGageService.addCandidate(1L, 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already a candidate");
    }

    @Test
    void removeCandidate_shouldRemoveCandidateFromCollectionAndSave() {
        Forfeit forfeit = buildForfeit(1L, "Sing a song");
        DailyGageCandidate candidate = DailyGageCandidate.builder().id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().add(candidate);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 1L)).thenReturn(Optional.of(candidate));

        dailyGageService.removeCandidate(1L, 1L);

        assertThat(dg.getCandidates()).doesNotContain(candidate);
        verify(dailyGageRepository).save(dg);
    }

    @Test
    void removeCandidate_shouldThrowWhenCandidateNotFound() {
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(candidateRepository.findByDailyGageIdAndForfeitId(1L, 99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dailyGageService.removeCandidate(1L, 99L))
                .isInstanceOf(EntityNotFoundException.class);
    }

    // ── vote ──────────────────────────────────────────────────────────────────

    @Test
    void vote_shouldThrowWhenGageIsAlreadySettled() {
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.SETTLED);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.vote(1L, 1L, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
    }

    @Test
    void vote_shouldThrowWhenGageIsNotInVoteMode() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.vote(1L, 1L, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not in VOTE mode");
    }

    @Test
    void vote_shouldThrowWhenCallerNotGroupMember() {
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(groupMemberGuard.requireActiveMembership(GROUP_ID, 1L))
                .thenThrow(new AccessDeniedException("You are not a member of this group"));

        assertThatThrownBy(() -> dailyGageService.vote(1L, 1L, 1))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void vote_shouldCreateNewVoteWhenNoneExists() {
        Forfeit forfeit = buildForfeit(1L, "Karaoke");
        DailyGageCandidate candidate = DailyGageCandidate.builder().id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().add(candidate);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
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
    void vote_shouldRemoveExistingVoteWhenValueIsZero() {
        Forfeit forfeit = buildForfeit(1L, "Karaoke");
        DailyGageCandidate candidate = DailyGageCandidate.builder().id(5L).forfeit(forfeit).votes(new ArrayList<>()).build();
        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().add(candidate);

        DailyGageVote existingVote = DailyGageVote.builder().id(20L).candidate(candidate).user(adminUser).vote(1).build();

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
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
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of());

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDayAndGroup(any(), any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenGageAlreadySettled() {
        DailyGage settled = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.SETTLED);
        settled.setForfeit(buildForfeit(1L, "Pushups"));

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of(settled));

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDayAndGroup(any(), any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenDirectModeHasNoForfeitSelected() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING);

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of(dg));

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(betParticipationRepository, never()).findSettledByMatchDayAndGroup(any(), any(), any(), any());
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_shouldSkip_whenNoSettledParticipationsForGroup() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(buildForfeit(1L, "Do pushups"));

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of(dg));
        when(betParticipationRepository.findSettledByMatchDayAndGroup(any(), any(), any(), eq(GROUP_ID)))
                .thenReturn(List.of());

        dailyGageService.onMatchSettled(MATCH_DAY);

        verify(userForfeitRepository, never()).save(any());
        verify(dailyGageRepository, never()).save(any());
    }

    @Test
    void onMatchSettled_directMode_shouldAssignForfeitToGroupLoserAndMarkSettled() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        User loser = User.builder().id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(forfeit);

        BetParticipation loserPart  = BetParticipation.builder().user(loser).pointsEarned(0).build();
        BetParticipation winnerPart = BetParticipation.builder().user(adminUser).pointsEarned(5).build();

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of(dg));
        when(betParticipationRepository.findSettledByMatchDayAndGroup(any(), any(), any(), eq(GROUP_ID)))
                .thenReturn(List.of(loserPart, winnerPart));
        when(groupMemberRepository.findByGroupId(GROUP_ID))
                .thenReturn(List.of(adminMembership(GroupMember.GroupRole.GROUP_ADMIN)));

        dailyGageService.onMatchSettled(MATCH_DAY);

        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.SETTLED);
        assertThat(dg.getAssignedTo()).isEqualTo(loser);

        ArgumentCaptor<UserForfeit> captor = ArgumentCaptor.forClass(UserForfeit.class);
        verify(userForfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(loser);
        assertThat(captor.getValue().getForfeit()).isEqualTo(forfeit);
        assertThat(captor.getValue().getAssignedBy()).isEqualTo(adminUser);
    }

    @Test
    void onMatchSettled_voteMode_shouldSelectForfeitWithHighestVoteScore() {
        Forfeit forfeitA = buildForfeit(1L, "Karaoke");
        Forfeit forfeitB = buildForfeit(2L, "Push-ups");

        DailyGageCandidate candidateA = DailyGageCandidate.builder().id(1L).forfeit(forfeitA)
                .votes(new ArrayList<>(List.of(
                        DailyGageVote.builder().vote(1).build(),
                        DailyGageVote.builder().vote(1).build()))).build();   // +2
        DailyGageCandidate candidateB = DailyGageCandidate.builder().id(2L).forfeit(forfeitB)
                .votes(new ArrayList<>(List.of(DailyGageVote.builder().vote(-1).build()))).build(); // -1

        User loser = User.builder().id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().addAll(List.of(candidateA, candidateB));

        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(dailyGageRepository.findByMatchDate(MATCH_DAY)).thenReturn(List.of(dg));
        when(betParticipationRepository.findSettledByMatchDayAndGroup(any(), any(), any(), eq(GROUP_ID)))
                .thenReturn(List.of(BetParticipation.builder().user(loser).pointsEarned(0).build()));
        when(groupMemberRepository.findByGroupId(GROUP_ID))
                .thenReturn(List.of(adminMembership(GroupMember.GroupRole.GROUP_ADMIN)));

        dailyGageService.onMatchSettled(MATCH_DAY);

        assertThat(dg.getForfeit()).isEqualTo(forfeitA);
        assertThat(dg.getStatus()).isEqualTo(DailyGage.Status.SETTLED);
    }

    // ── forceSettle ──────────────────────────────────────────────────────────

    @Test
    void forceSettle_shouldThrow_whenGageIsAlreadySettled() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.SETTLED);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.forceSettle(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already settled");
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void forceSettle_shouldThrow_whenGageIsStillPending() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        assertThatThrownBy(() -> dailyGageService.forceSettle(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ACTIVE");
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void forceSettle_shouldThrow_whenMatchesStillUnfinished() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(buildForfeit(1L, "Do pushups"));
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(2L);

        assertThatThrownBy(() -> dailyGageService.forceSettle(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non terminé");
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void forceSettle_shouldThrow_whenCallerIsNotGroupAdmin() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(groupMemberGuard.requireGroupAdmin(GROUP_ID, 1L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> dailyGageService.forceSettle(1L))
                .isInstanceOf(AccessDeniedException.class);
        verify(userForfeitRepository, never()).save(any());
    }

    @Test
    void forceSettle_directMode_shouldAssignForfeitToLoserAndMarkSettled() {
        Forfeit forfeit = buildForfeit(1L, "Do pushups");
        User loser = User.builder().id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(forfeit);

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(betParticipationRepository.findSettledByMatchDayAndGroup(any(), any(), any(), eq(GROUP_ID)))
                .thenReturn(List.of(
                        BetParticipation.builder().user(loser).pointsEarned(0).build(),
                        BetParticipation.builder().user(adminUser).pointsEarned(5).build()));
        when(groupMemberRepository.findByGroupId(GROUP_ID))
                .thenReturn(List.of(adminMembership(GroupMember.GroupRole.GROUP_ADMIN)));

        DailyGageResponse result = dailyGageService.forceSettle(1L);

        assertThat(result.getStatus()).isEqualTo("SETTLED");
        assertThat(result.getAssignedToUsername()).isEqualTo("loser");
        assertThat(dg.getAssignedTo()).isEqualTo(loser);

        ArgumentCaptor<UserForfeit> captor = ArgumentCaptor.forClass(UserForfeit.class);
        verify(userForfeitRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(loser);
        assertThat(captor.getValue().getForfeit()).isEqualTo(forfeit);
    }

    @Test
    void forceSettle_voteMode_shouldSelectHighestVotedForfeitAndAssignToLoser() {
        Forfeit forfeitA = buildForfeit(1L, "Karaoke");
        Forfeit forfeitB = buildForfeit(2L, "Push-ups");

        User loser = User.builder().id(3L).username("loser").email("l@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        // votes must carry a user so toResponse() can compute per-user vote
        DailyGageCandidate candidateA = DailyGageCandidate.builder().id(1L).forfeit(forfeitA)
                .votes(new ArrayList<>(List.of(
                        DailyGageVote.builder().vote(1).user(adminUser).build(),
                        DailyGageVote.builder().vote(1).user(loser).build()))).build(); // score +2
        DailyGageCandidate candidateB = DailyGageCandidate.builder().id(2L).forfeit(forfeitB)
                .votes(new ArrayList<>(List.of(
                        DailyGageVote.builder().vote(-1).user(adminUser).build()))).build(); // score -1

        DailyGage dg = gage(1L, DailyGage.Mode.VOTE, DailyGage.Status.ACTIVE);
        dg.getCandidates().addAll(List.of(candidateA, candidateB));

        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);
        when(betParticipationRepository.findSettledByMatchDayAndGroup(any(), any(), any(), eq(GROUP_ID)))
                .thenReturn(List.of(BetParticipation.builder().user(loser).pointsEarned(0).build()));
        when(groupMemberRepository.findByGroupId(GROUP_ID))
                .thenReturn(List.of(adminMembership(GroupMember.GroupRole.GROUP_ADMIN)));

        DailyGageResponse result = dailyGageService.forceSettle(1L);

        assertThat(result.getStatus()).isEqualTo("SETTLED");
        assertThat(dg.getForfeit()).isEqualTo(forfeitA);
        assertThat(result.getAssignedToUsername()).isEqualTo("loser");
    }

    // ── canForceSettle flag ───────────────────────────────────────────────────

    @Test
    void canForceSettle_shouldBeTrue_whenActiveAndAllMatchesFinished() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(buildForfeit(1L, "Do pushups"));
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(0L);

        DailyGageResponse result = dailyGageService.getDailyGageById(1L);

        assertThat(result.isCanForceSettle()).isTrue();
    }

    @Test
    void canForceSettle_shouldBeFalse_whenActiveButMatchesStillRunning() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.ACTIVE);
        dg.setForfeit(buildForfeit(1L, "Do pushups"));
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));
        when(matchRepository.countUnfinishedMatchesOnDay(any(), any(), any())).thenReturn(1L);

        DailyGageResponse result = dailyGageService.getDailyGageById(1L);

        assertThat(result.isCanForceSettle()).isFalse();
    }

    @Test
    void canForceSettle_shouldBeFalse_whenPendingEvenIfMatchesFinished() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.PENDING);
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        DailyGageResponse result = dailyGageService.getDailyGageById(1L);

        assertThat(result.isCanForceSettle()).isFalse();
        // short-circuit: no DB call needed when status != ACTIVE
        verify(matchRepository, never()).countUnfinishedMatchesOnDay(any(), any(), any());
    }

    @Test
    void canForceSettle_shouldBeFalse_whenAlreadySettled() {
        DailyGage dg = gage(1L, DailyGage.Mode.DIRECT, DailyGage.Status.SETTLED);
        dg.setForfeit(buildForfeit(1L, "Do pushups"));
        when(dailyGageRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(dg));

        DailyGageResponse result = dailyGageService.getDailyGageById(1L);

        assertThat(result.isCanForceSettle()).isFalse();
        verify(matchRepository, never()).countUnfinishedMatchesOnDay(any(), any(), any());
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private GroupMember adminMembership(GroupMember.GroupRole role) {
        return GroupMember.builder()
                .id(1L).group(group).user(adminUser)
                .role(role).status(GroupMember.MemberStatus.ACTIVE)
                .build();
    }

    private DailyGage gage(Long id, DailyGage.Mode mode, DailyGage.Status status) {
        return DailyGage.builder()
                .id(id).group(group).matchDate(MATCH_DAY).mode(mode)
                .status(status).candidates(new ArrayList<>())
                .build();
    }

    private CreateDailyGageRequest buildRequest(LocalDate date, DailyGage.Mode mode) {
        CreateDailyGageRequest req = new CreateDailyGageRequest();
        req.setGroupId(GROUP_ID);
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
