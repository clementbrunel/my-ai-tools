package com.pronocore.service;

import com.pronocore.dto.response.DashboardStatsResponse;
import com.pronocore.entity.Bet;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.Sport;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock private BetRepository              betRepository;
    @Mock private BetParticipationRepository betParticipationRepository;
    @Mock private GroupMemberRepository      groupMemberRepository;
    @Mock private UserRepository             userRepository;

    @InjectMocks
    private DashboardService dashboardService;

    private User alice;
    private User bob;
    private User charlie;
    private Group group;

    @BeforeEach
    void setUp() {
        alice = user(1L, "alice");
        bob   = user(2L, "bob");
        charlie = user(3L, "charlie");

        group = Group.builder()
                .id(10L).name("Test Group").inviteCode("TESTCODE").createdBy(alice)
                .build();
    }

    // ── getStats: user not found ──────────────────────────────────────────────

    @Test
    void getStats_shouldThrowWhenUserNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardService.getStats("ghost", Sport.FOOT))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    // ── getStats: upcoming matches count ──────────────────────────────────────

    @Test
    void getStats_shouldReturnUpcomingMatchCountFromUserGroups() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(
                1L, Bet.Status.OPEN, Match.Status.UPCOMING)).thenReturn(5L);
        when(groupMemberRepository.findByUserId(1L)).thenReturn(List.of());

        DashboardStatsResponse result = dashboardService.getStats("alice", Sport.FOOT);

        assertThat(result.getUpcomingMatchesInMyGroups()).isEqualTo(5L);
    }

    // ── getStats: user not in any group ───────────────────────────────────────

    @Test
    void getStats_shouldReturnEmptyGroupRanksWhenUserHasNoGroups() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(1L)).thenReturn(List.of());

        DashboardStatsResponse result = dashboardService.getStats("alice", Sport.FOOT);

        assertThat(result.getGroupRanks()).isEmpty();
        verifyNoInteractions(betParticipationRepository);
    }

    // ── getStats: rank computation ────────────────────────────────────────────

    /**
     * Group of 3: alice=50 pts, bob=30 pts (current user), charlie=20 pts.
     * Bob should appear at rank 2 out of 3.
     */
    @Test
    void getStats_shouldComputeRankBasedOnGroupPoints() {
        GroupMember bobMembership = membership(bob, group);

        // All members in the group
        GroupMember aliceMembership   = membership(alice,   group);
        GroupMember charlieMembership = membership(charlie, group);

        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(2L)).thenReturn(List.of(bobMembership));
        when(groupMemberRepository.findByGroupIdIn(List.of(10L)))
                .thenReturn(List.of(aliceMembership, bobMembership, charlieMembership));

        // Rows: [groupId, userId, points]
        when(betParticipationRepository.sumPointsByGroupIdsAndSport(List.of(10L), false))
                .thenReturn(pointRows(new Object[]{10L, 1L, 50}, new Object[]{10L, 2L, 30}, new Object[]{10L, 3L, 20}));

        DashboardStatsResponse result = dashboardService.getStats("bob", Sport.FOOT);

        assertThat(result.getGroupRanks()).hasSize(1);
        var rank = result.getGroupRanks().get(0);
        assertThat(rank.getGroupId()).isEqualTo(10L);
        assertThat(rank.getGroupName()).isEqualTo("Test Group");
        assertThat(rank.getRank()).isEqualTo(2);
        assertThat(rank.getTotal()).isEqualTo(3);
        assertThat(rank.getPoints()).isEqualTo(30);
    }

    /**
     * Alice is first in the group — rank should be 1.
     */
    @Test
    void getStats_shouldReturnRankOneForTopPlayer() {
        GroupMember aliceMembership = membership(alice, group);
        GroupMember bobMembership   = membership(bob,   group);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(1L)).thenReturn(List.of(aliceMembership));
        when(groupMemberRepository.findByGroupIdIn(List.of(10L)))
                .thenReturn(List.of(aliceMembership, bobMembership));

        when(betParticipationRepository.sumPointsByGroupIdsAndSport(List.of(10L), false))
                .thenReturn(pointRows(new Object[]{10L, 1L, 100}, new Object[]{10L, 2L, 40}));

        DashboardStatsResponse result = dashboardService.getStats("alice", Sport.FOOT);

        assertThat(result.getGroupRanks().get(0).getRank()).isEqualTo(1);
        assertThat(result.getGroupRanks().get(0).getPoints()).isEqualTo(100);
    }

    /**
     * User is in a group but has not participated in any bet yet → points = 0, rank = last.
     */
    @Test
    void getStats_shouldDefaultToZeroPointsAndLastRankWhenNoParticipation() {
        GroupMember aliceMembership = membership(alice, group);
        GroupMember bobMembership   = membership(bob,   group);

        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(2L)).thenReturn(List.of(bobMembership));
        when(groupMemberRepository.findByGroupIdIn(List.of(10L)))
                .thenReturn(List.of(aliceMembership, bobMembership));

        // Only alice has participation rows; bob has none → defaults to 0
        when(betParticipationRepository.sumPointsByGroupIdsAndSport(List.of(10L), false))
                .thenReturn(pointRows(new Object[]{10L, 1L, 50}));

        DashboardStatsResponse result = dashboardService.getStats("bob", Sport.FOOT);

        var rank = result.getGroupRanks().get(0);
        assertThat(rank.getPoints()).isEqualTo(0);
        assertThat(rank.getRank()).isEqualTo(2); // alice is first, bob is last
        assertThat(rank.getTotal()).isEqualTo(2);
    }

    /**
     * On equal points, the member with more bets won ranks higher — same tie-break
     * the leaderboard page uses, so the two rankings never disagree.
     */
    @Test
    void getStats_shouldBreakPointsTieByBetsWon() {
        GroupMember aliceMembership = membership(alice, group);
        GroupMember bobMembership   = membership(bob,   group);

        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(2L)).thenReturn(List.of(bobMembership));
        when(groupMemberRepository.findByGroupIdIn(List.of(10L)))
                .thenReturn(List.of(aliceMembership, bobMembership));

        // Alice and bob are tied on points, but bob has won more bets
        when(betParticipationRepository.sumPointsByGroupIdsAndSport(List.of(10L), false))
                .thenReturn(pointRows(new Object[]{10L, 1L, 30}, new Object[]{10L, 2L, 30}));
        when(betParticipationRepository.countBetsWonByGroupIdsAndSport(List.of(10L), false))
                .thenReturn(pointRows(new Object[]{10L, 1L, 2}, new Object[]{10L, 2L, 3}));

        DashboardStatsResponse result = dashboardService.getStats("bob", Sport.FOOT);

        var rank = result.getGroupRanks().get(0);
        assertThat(rank.getPoints()).isEqualTo(30);
        assertThat(rank.getRank()).isEqualTo(1); // bob wins the tie-break on bets won
    }

    /**
     * A group with F1 only (no FOOT) must not contribute a groupRank, since the
     * dashboard is a football-only page.
     */
    @Test
    void getStats_shouldExcludeGroupsWithoutFootballEnabled() {
        Group f1OnlyGroup = Group.builder()
                .id(20L).name("F1 Only Group").inviteCode("F1CODE").createdBy(alice)
                .sports(java.util.Set.of(Sport.F1))
                .build();
        GroupMember aliceF1Membership = membership(alice, f1OnlyGroup);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(betRepository.countDistinctUpcomingMatchesInUserGroups(any(), any(), any())).thenReturn(0L);
        when(groupMemberRepository.findByUserId(1L)).thenReturn(List.of(aliceF1Membership));

        DashboardStatsResponse result = dashboardService.getStats("alice", Sport.FOOT);

        assertThat(result.getGroupRanks()).isEmpty();
        verifyNoInteractions(betParticipationRepository);
    }

    // ── getStats: F1 sport ─────────────────────────────────────────────────────

    /**
     * A group with FOOT only (no F1) must not contribute a groupRank when
     * querying the F1 dashboard, and matches never get counted for F1.
     */
    @Test
    void getStats_shouldExcludeGroupsWithoutF1EnabledAndSkipMatchCount() {
        GroupMember aliceMembership = membership(alice, group); // group defaults to FOOT only

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(groupMemberRepository.findByUserId(1L)).thenReturn(List.of(aliceMembership));

        DashboardStatsResponse result = dashboardService.getStats("alice", Sport.F1);

        assertThat(result.getGroupRanks()).isEmpty();
        assertThat(result.getUpcomingMatchesInMyGroups()).isZero();
        verifyNoInteractions(betRepository, betParticipationRepository);
    }

    /**
     * F1 group ranks are computed from F1-only points (race bets), ignoring
     * any football points the same members may have in a mixed-sport group.
     */
    @Test
    void getStats_shouldComputeF1RankFromF1PointsOnly() {
        Group f1Group = Group.builder()
                .id(30L).name("F1 Group").inviteCode("F1CODE2").createdBy(alice)
                .sports(java.util.Set.of(Sport.F1))
                .build();
        GroupMember aliceMembership = membership(alice, f1Group);
        GroupMember bobMembership   = membership(bob,   f1Group);

        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(groupMemberRepository.findByUserId(2L)).thenReturn(List.of(bobMembership));
        when(groupMemberRepository.findByGroupIdIn(List.of(30L)))
                .thenReturn(List.of(aliceMembership, bobMembership));

        when(betParticipationRepository.sumPointsByGroupIdsAndSport(List.of(30L), true))
                .thenReturn(pointRows(new Object[]{30L, 1L, 10}, new Object[]{30L, 2L, 25}));

        DashboardStatsResponse result = dashboardService.getStats("bob", Sport.F1);

        assertThat(result.getGroupRanks()).hasSize(1);
        var rank = result.getGroupRanks().get(0);
        assertThat(rank.getGroupId()).isEqualTo(30L);
        assertThat(rank.getRank()).isEqualTo(1);
        assertThat(rank.getPoints()).isEqualTo(25);
        verifyNoInteractions(betRepository);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User user(Long id, String username) {
        return User.builder()
                .id(id).username(username).email(username + "@test.com")
                .password("encoded").role(User.Role.USER)
                .build();
    }

    private List<Object[]> pointRows(Object[]... rows) {
        return java.util.Arrays.asList(rows);
    }

    private GroupMember membership(User user, Group grp) {
        return GroupMember.builder()
                .id(user.getId()).group(grp).user(user)
                .role(GroupMember.GroupRole.MEMBER)
                .status(GroupMember.MemberStatus.ACTIVE)
                .build();
    }
}
