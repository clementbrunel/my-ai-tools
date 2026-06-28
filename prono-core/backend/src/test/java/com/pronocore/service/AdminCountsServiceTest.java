package com.pronocore.service;

import com.pronocore.dto.response.AdminCountsResponse;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminCountsServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private ForfeitRepository forfeitRepository;
    @Mock private BetRepository betRepository;
    @Mock private DailyGageRepository dailyGageRepository;

    @InjectMocks
    private AdminCountsService adminCountsService;

    private User user;
    private Group groupA;
    private Group groupB;
    private GroupMember adminMemberA;
    private GroupMember adminMemberB;
    private GroupMember regularMember;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L).username("alice").email("alice@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        groupA = Group.builder().id(12L).name("Groupe A").build();
        groupB = Group.builder().id(17L).name("Groupe B").build();

        adminMemberA = GroupMember.builder()
                .id(10L).user(user).group(groupA)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .status(GroupMember.MemberStatus.ACTIVE)
                .build();

        adminMemberB = GroupMember.builder()
                .id(11L).user(user).group(groupB)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .status(GroupMember.MemberStatus.ACTIVE)
                .build();

        regularMember = GroupMember.builder()
                .id(12L).user(user).group(groupA)
                .role(GroupMember.GroupRole.MEMBER)
                .status(GroupMember.MemberStatus.ACTIVE)
                .build();
    }

    // -------------------------------------------------------------------------
    // Unknown user
    // -------------------------------------------------------------------------

    @Test
    void getCounts_unknownUser_throwsEntityNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminCountsService.getCounts("ghost"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("ghost");
    }

    // -------------------------------------------------------------------------
    // No admin groups
    // -------------------------------------------------------------------------

    @Test
    void getCounts_noAdminGroups_returnsAllZeros() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(regularMember));

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        assertThat(result.getPendingApplications()).isZero();
        assertThat(result.getPendingForfeitsPerGroup()).isEmpty();
        assertThat(result.getMissingGagesPerGroup()).isEmpty();
        assertThat(result.getGroupsWithNoBets()).isEmpty();
        assertThat(result.getMatchesWithoutBetsPerGroup()).isEmpty();

        verifyNoInteractions(forfeitRepository, betRepository, dailyGageRepository);
    }

    // -------------------------------------------------------------------------
    // Happy path — one admin group
    // -------------------------------------------------------------------------

    @Test
    void getCounts_oneAdminGroup_aggregatesCorrectly() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));

        // 2 pending applications in groupA
        when(groupMemberRepository.countByGroupIdAndStatus(12L, GroupMember.MemberStatus.PENDING))
                .thenReturn(2L);

        // 3 pending forfeits in groupA
        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(12L))
                .thenReturn(List.of(forfeit(), forfeit(), forfeit()));

        // groupA has OPEN bets on 2 dates; DailyGage covers only the first
        Match m1 = match(LocalDateTime.of(2026, 6, 14, 18, 0));
        Match m2 = match(LocalDateTime.of(2026, 6, 15, 20, 0));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(m1, m2));

        DailyGage gageWithForfeit = DailyGage.builder()
                .group(groupA)
                .matchDate(LocalDate.of(2026, 6, 14))
                .forfeit(forfeit())
                .build();
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L)))
                .thenReturn(List.of(gageWithForfeit));

        // groupA has open bets
        when(betRepository.existsByGroupIdAndStatus(12L, Bet.Status.OPEN)).thenReturn(true);

        // 5 upcoming matches not yet open in groupA
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(5L);

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        assertThat(result.getPendingApplications()).isEqualTo(2);
        assertThat(result.getPendingForfeitsPerGroup()).containsEntry(12L, 3);
        // 2 open-bet dates, 1 covered → 1 missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
        // has open bets → false
        assertThat(result.getGroupsWithNoBets()).containsEntry(12L, false);
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 5);
    }

    // -------------------------------------------------------------------------
    // Two admin groups
    // -------------------------------------------------------------------------

    @Test
    void getCounts_twoAdminGroups_eachGroupIsolated() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA, adminMemberB));

        when(groupMemberRepository.countByGroupIdAndStatus(12L, GroupMember.MemberStatus.PENDING)).thenReturn(1L);
        when(groupMemberRepository.countByGroupIdAndStatus(17L, GroupMember.MemberStatus.PENDING)).thenReturn(0L);

        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(12L)).thenReturn(List.of(forfeit()));
        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(17L)).thenReturn(List.of());

        // groupA has open bets on 2026-06-14; groupB has none
        Match m1 = match(LocalDateTime.of(2026, 6, 14, 18, 0));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(m1));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(17L)).thenReturn(List.of());

        // groupA covered, groupB not
        DailyGage covered = DailyGage.builder()
                .group(groupA).matchDate(LocalDate.of(2026, 6, 14)).forfeit(forfeit()).build();
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(anyList()))
                .thenReturn(List.of(covered));

        when(betRepository.existsByGroupIdAndStatus(12L, Bet.Status.OPEN)).thenReturn(true);
        when(betRepository.existsByGroupIdAndStatus(17L, Bet.Status.OPEN)).thenReturn(false);

        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(17L)).thenReturn(16L);

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        assertThat(result.getPendingApplications()).isEqualTo(1);
        assertThat(result.getPendingForfeitsPerGroup()).containsEntry(12L, 1).containsEntry(17L, 0);
        // groupA: 1 date covered → 0 missing; groupB: 0 open-bet dates → 0 missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 0).containsEntry(17L, 0);
        assertThat(result.getGroupsWithNoBets()).containsEntry(12L, false).containsEntry(17L, true);
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 0).containsEntry(17L, 16);
    }

    // -------------------------------------------------------------------------
    // DailyGage without forfeit is not counted as covered
    // -------------------------------------------------------------------------

    @Test
    void getCounts_dailyGageWithNullForfeit_notCountedAsCovered() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countByGroupIdAndStatus(12L, GroupMember.MemberStatus.PENDING)).thenReturn(0L);
        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(12L)).thenReturn(List.of());

        Match m1 = match(LocalDateTime.of(2026, 6, 14, 18, 0));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(m1));

        // DailyGage exists but forfeit is null (not yet selected)
        DailyGage gageNoForfeit = DailyGage.builder()
                .group(groupA).matchDate(LocalDate.of(2026, 6, 14)).forfeit(null).build();
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L)))
                .thenReturn(List.of(gageNoForfeit));

        when(betRepository.existsByGroupIdAndStatus(12L, Bet.Status.OPEN)).thenReturn(true);
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        // No forfeit assigned → still missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
    }

    // -------------------------------------------------------------------------
    // Duplicate match dates are deduplicated
    // -------------------------------------------------------------------------

    @Test
    void getCounts_sameMatchDateTwice_countedOnce() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countByGroupIdAndStatus(12L, GroupMember.MemberStatus.PENDING)).thenReturn(0L);
        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(12L)).thenReturn(List.of());

        // Two OPEN-bet matches on the same calendar day (different kick-off times)
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(
                match(LocalDateTime.of(2026, 6, 14, 16, 0)),
                match(LocalDateTime.of(2026, 6, 14, 20, 0))
        ));
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L))).thenReturn(List.of());
        when(betRepository.existsByGroupIdAndStatus(12L, Bet.Status.OPEN)).thenReturn(true);
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        // Two matches same day → only 1 missing date, not 2
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
    }

    // -------------------------------------------------------------------------
    // missingGages ignores days without open bets (new matches not yet opened)
    // -------------------------------------------------------------------------

    @Test
    void getCounts_newMatchesNotOpenedYet_notCountedInMissingGages() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(groupMemberRepository.findByUserIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countByGroupIdAndStatus(12L, GroupMember.MemberStatus.PENDING)).thenReturn(0L);
        when(forfeitRepository.findByActiveFalseAndGroupIdOrderById(12L)).thenReturn(List.of());

        // No OPEN bets for this group yet (16 matches added but not opened)
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of());
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L))).thenReturn(List.of());
        when(betRepository.existsByGroupIdAndStatus(12L, Bet.Status.OPEN)).thenReturn(false);
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(16L);

        AdminCountsResponse result = adminCountsService.getCounts("alice");

        // No open bets → no active days → no missing gages
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 0);
        // But 16 matches need to be opened
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 16);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Forfeit forfeit() {
        return Forfeit.builder().id((long) (Math.random() * 10000))
                .title("Gage test").active(false).build();
    }

    private Match match(LocalDateTime dateTime) {
        return Match.builder().id((long) (Math.random() * 10000))
                .teamA("A").teamB("B").matchDate(dateTime).build();
    }
}
