package com.pronocore.service;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.entity.*;
import com.pronocore.mapper.BetMapper;
import com.pronocore.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BetServiceTest {

    @Mock private BetRepository betRepository;
    @Mock private BetParticipationRepository participationRepository;
    @Mock private UserRepository userRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private ForfeitRepository forfeitRepository;
    @Mock private UserForfeitRepository userForfeitRepository;
    @Mock private BetMapper betMapper;

    @InjectMocks
    private BetService betService;

    private User testUser;
    private Group testGroup;
    private Bet testBet;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
            .id(1L).username("testuser").email("test@example.com")
            .password("encoded").role(User.Role.USER)
            .globalScore(0).betsWon(0).forfeitsReceived(0)
            .build();

        testGroup = Group.builder().id(7L).name("Les Potes").build();

        testBet = Bet.builder()
            .id(1L).title("Test Bet").description("Test description")
            .betType(Bet.BetType.FREE).points(10)
            .deadline(LocalDateTime.now().plusHours(2))
            .status(Bet.Status.OPEN)
            .creator(testUser).group(testGroup)
            .build();
    }

    private GroupMember membership(GroupMember.GroupRole role, GroupMember.MemberStatus status) {
        return GroupMember.builder()
            .id(1L).group(testGroup).user(testUser).role(role).status(status)
            .build();
    }

    private void stubActiveMember(GroupMember.GroupRole role) {
        when(groupMemberRepository.findByGroupIdAndUserId(7L, 1L))
            .thenReturn(Optional.of(membership(role, GroupMember.MemberStatus.ACTIVE)));
    }

    // ── openMatchForBetting ─────────────────────────────────────────────────────

    @Test
    void openMatchForBetting_groupAdminCreatesScoreBet() {
        Match match = Match.builder().id(5L).teamA("France").teamB("Brésil")
            .matchDate(LocalDateTime.now().plusHours(2)).status(Match.Status.UPCOMING).build();

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.GROUP_ADMIN);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(testGroup));
        when(matchRepository.findById(5L)).thenReturn(Optional.of(match));
        when(betRepository.existsByMatchIdAndGroupId(5L, 7L)).thenReturn(false);
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betMapper.toResponse(any(Bet.class))).thenReturn(BetResponse.builder().id(99L).build());
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        betService.openMatchForBetting(7L, 5L, "testuser");

        verify(betRepository).save(argThat(b ->
            b.getGroup() == testGroup
                && b.getMatch() == match
                && b.getBetType() == Bet.BetType.SCORE
                && b.getStatus() == Bet.Status.OPEN));
    }

    @Test
    void openMatchForBetting_forbiddenWhenNotGroupAdmin() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);

        assertThatThrownBy(() -> betService.openMatchForBetting(7L, 5L, "testuser"))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("admin");
        verify(betRepository, never()).save(any());
    }

    @Test
    void openMatchForBetting_conflictWhenMatchAlreadyOpenInGroup() {
        Match match = Match.builder().id(5L).teamA("France").teamB("Brésil")
            .matchDate(LocalDateTime.now().plusHours(2)).status(Match.Status.UPCOMING).build();

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.GROUP_ADMIN);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(testGroup));
        when(matchRepository.findById(5L)).thenReturn(Optional.of(match));
        when(betRepository.existsByMatchIdAndGroupId(5L, 7L)).thenReturn(true);

        assertThatThrownBy(() -> betService.openMatchForBetting(7L, 5L, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("already open");
        verify(betRepository, never()).save(any());
    }

    @Test
    void openCompetitionForBetting_opensOnlyMatchesNotYetOpenInGroup() {
        Match m1 = Match.builder().id(10L).teamA("France").teamB("Brésil")
            .matchDate(LocalDateTime.now().plusHours(2)).competition("World Cup").build();
        Match m2 = Match.builder().id(11L).teamA("Italie").teamB("Espagne")
            .matchDate(LocalDateTime.now().plusHours(4)).competition("World Cup").build();

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.GROUP_ADMIN);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(testGroup));
        when(matchRepository.findByCompetitionOrderByMatchDateAsc("World Cup")).thenReturn(List.of(m1, m2));
        // m1 already open in the group → skipped; m2 is created
        when(betRepository.existsByMatchIdAndGroupId(10L, 7L)).thenReturn(true);
        when(betRepository.existsByMatchIdAndGroupId(11L, 7L)).thenReturn(false);
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betMapper.toResponse(any(Bet.class))).thenReturn(BetResponse.builder().id(99L).build());
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        List<BetResponse> created = betService.openCompetitionForBetting(7L, "World Cup", "testuser");

        assertThat(created).hasSize(1);
        verify(betRepository, times(1)).save(argThat(b -> b.getMatch() == m2 && b.getGroup() == testGroup));
        verify(betRepository, never()).save(argThat(b -> b.getMatch() == m1));
    }

    @Test
    void openCompetitionForBetting_forbiddenWhenNotGroupAdmin() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);

        assertThatThrownBy(() -> betService.openCompetitionForBetting(7L, "World Cup", "testuser"))
            .isInstanceOf(AccessDeniedException.class);
        verify(betRepository, never()).save(any());
    }

    // ── createBet ───────────────────────────────────────────────────────────────

    @Test
    void createBet_groupAdminCreatesBetSuccessfully() {
        Match testMatch = Match.builder().id(1L).teamA("France").teamB("Brésil")
            .matchDate(LocalDateTime.now().plusHours(2)).status(Match.Status.UPCOMING).build();

        CreateBetRequest request = new CreateBetRequest();
        request.setTitle("Test Bet");
        request.setDescription("Test description");
        request.setMatchId(1L);
        request.setGroupId(7L);
        request.setBetType(Bet.BetType.SCORE);
        request.setPoints(10);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.GROUP_ADMIN);
        when(groupRepository.findById(7L)).thenReturn(Optional.of(testGroup));
        when(matchRepository.findById(1L)).thenReturn(Optional.of(testMatch));
        when(betRepository.existsByMatchIdAndGroupId(1L, 7L)).thenReturn(false);
        when(betRepository.save(any(Bet.class))).thenReturn(testBet);
        when(betMapper.toResponse(any(Bet.class))).thenReturn(BetResponse.builder().id(1L).title("Test Bet").build());
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        BetResponse result = betService.createBet(request, "testuser");

        assertThat(result.getTitle()).isEqualTo("Test Bet");
        verify(betRepository).save(argThat(b -> b.getGroup() == testGroup));
    }

    @Test
    void createBet_forbiddenWhenNotGroupAdmin() {
        CreateBetRequest request = new CreateBetRequest();
        request.setMatchId(1L);
        request.setGroupId(7L);
        request.setBetType(Bet.BetType.SCORE);
        request.setPoints(10);

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);

        assertThatThrownBy(() -> betService.createBet(request, "testuser"))
            .isInstanceOf(AccessDeniedException.class);
        verify(betRepository, never()).save(any());
    }

    // ── participate ─────────────────────────────────────────────────────────────

    @Test
    void participate_shouldThrowWhenBetNotOpen() {
        testBet.setStatus(Bet.Status.VALIDATED);
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Option A");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("not open");
    }

    @Test
    void participate_shouldThrowWhenNotGroupMember() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(groupMemberRepository.findByGroupIdAndUserId(7L, 1L)).thenReturn(Optional.empty());

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Option A");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("not a member");
    }

    @Test
    void participate_shouldThrowWhenAlreadyParticipated() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);
        when(participationRepository.existsByBetIdAndUserId(1L, 1L)).thenReturn(true);

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Option A");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("already participated");
    }

    @Test
    void participate_shouldThrowWhenDeadlinePassed() {
        testBet.setDeadline(LocalDateTime.now().minusMinutes(5));
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Victoire France 2-1");

        assertThatThrownBy(() -> betService.participate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("déjà commencé");
    }

    // ── upsertParticipate ───────────────────────────────────────────────────────

    @Test
    void upsertParticipate_shouldThrowWhenBetNotOpen() {
        testBet.setStatus(Bet.Status.VALIDATED);
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Victoire France 2-1");

        assertThatThrownBy(() -> betService.upsertParticipate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("not open");
    }

    @Test
    void upsertParticipate_shouldThrowWhenDeadlinePassed() {
        testBet.setDeadline(LocalDateTime.now().minusMinutes(5));
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Victoire France 2-1");

        assertThatThrownBy(() -> betService.upsertParticipate(1L, request, "testuser"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("déjà commencé");
    }

    @Test
    void upsertParticipate_shouldCreateNewParticipationWhenNoneExists() {
        BetParticipationResponse expectedResponse = BetParticipationResponse.builder()
            .id(1L).chosenOption("Victoire France 2-1").build();

        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);
        when(participationRepository.findByBetIdAndUserId(1L, 1L)).thenReturn(Optional.empty());
        when(participationRepository.save(any(BetParticipation.class))).thenReturn(new BetParticipation());
        when(betMapper.toParticipationResponse(any())).thenReturn(expectedResponse);

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Victoire France 2-1");

        BetParticipationResponse result = betService.upsertParticipate(1L, request, "testuser");

        assertThat(result.getChosenOption()).isEqualTo("Victoire France 2-1");
        verify(participationRepository).save(argThat(p ->
            p.getChosenOption().equals("Victoire France 2-1") && p.getUser() == testUser));
    }

    @Test
    void upsertParticipate_shouldUpdateExistingParticipationInPlace() {
        BetParticipation existing = BetParticipation.builder()
            .id(5L).bet(testBet).user(testUser)
            .chosenOption("Match nul 0-0")
            .build();

        BetParticipationResponse expectedResponse = BetParticipationResponse.builder()
            .id(5L).chosenOption("Victoire France 2-1").build();

        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        stubActiveMember(GroupMember.GroupRole.MEMBER);
        when(participationRepository.findByBetIdAndUserId(1L, 1L)).thenReturn(Optional.of(existing));
        when(participationRepository.save(existing)).thenReturn(existing);
        when(betMapper.toParticipationResponse(existing)).thenReturn(expectedResponse);

        ParticipateRequest request = new ParticipateRequest();
        request.setChosenOption("Victoire France 2-1");

        betService.upsertParticipate(1L, request, "testuser");

        assertThat(existing.getChosenOption()).isEqualTo("Victoire France 2-1");
        verify(participationRepository).save(existing);
    }

    // ── validateBet ─────────────────────────────────────────────────────────────

    @Test
    void validateBet_shouldAwardPointsToWinners() {
        User winner = User.builder().id(2L).username("winner")
            .globalScore(0).betsWon(0).forfeitsReceived(0).build();

        BetParticipation participation = BetParticipation.builder()
            .id(1L).bet(testBet).user(winner).chosenOption("France").build();

        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));
        when(participationRepository.findByBetIdAndChosenOption(1L, "France")).thenReturn(List.of(participation));
        when(betRepository.save(any(Bet.class))).thenReturn(testBet);
        when(betMapper.toResponse(any(Bet.class)))
            .thenReturn(BetResponse.builder().id(1L).status(Bet.Status.VALIDATED).winningOption("France").build());
        when(betRepository.countParticipationsByBetId(any())).thenReturn(1L);

        BetResponse result = betService.validateBet(1L, "France");

        assertThat(result.getStatus()).isEqualTo(Bet.Status.VALIDATED);
        assertThat(winner.getGlobalScore()).isEqualTo(10);
        assertThat(winner.getBetsWon()).isEqualTo(1);
        // pointsEarned must be persisted so the group leaderboard counts this win
        assertThat(participation.getPointsEarned()).isEqualTo(10);
        verify(userRepository).save(winner);
        verify(participationRepository).save(participation);
    }

    @Test
    void validateBet_shouldThrowWhenAlreadySettled() {
        testBet.setStatus(Bet.Status.VALIDATED);
        when(betRepository.findById(1L)).thenReturn(Optional.of(testBet));

        assertThatThrownBy(() -> betService.validateBet(1L, "France"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("already been settled");

        verify(participationRepository, never()).findByBetIdAndChosenOption(any(), any());
        verify(userRepository, never()).save(any());
    }

    // ── getBetsForUser ──────────────────────────────────────────────────────────

    @Test
    void getBetsForUser_shouldReturnBetsFromUserGroups() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(betRepository.findAllInUserActiveGroups(1L)).thenReturn(List.of(testBet));
        when(betMapper.toResponse(any(Bet.class))).thenReturn(BetResponse.builder().id(1L).title("Test Bet").build());
        when(betRepository.countParticipationsByBetId(any())).thenReturn(0L);

        List<BetResponse> result = betService.getBetsForUser("testuser");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("Test Bet");
        verify(betRepository).findAllInUserActiveGroups(1L);
    }
}
