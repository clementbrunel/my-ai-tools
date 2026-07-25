package com.pronocore.service;

import com.pronocore.dto.response.GroupAdminCountsResponse;
import com.pronocore.dto.response.RaceResponse;
import com.pronocore.entity.*;
import com.pronocore.entity.GroupMember.MemberStatus;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.mapper.RaceMapper;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupAdminServiceTest {

    @Mock private GroupService          groupService;
    @Mock private GroupMemberGuard      groupMemberGuard;
    @Mock private GroupRepository       groupRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private UserRepository        userRepository;
    @Mock private BetRepository         betRepository;
    @Mock private ForfeitRepository     forfeitRepository;
    @Mock private DailyGageRepository   dailyGageRepository;
    @Mock private MatchMapper           matchMapper;
    @Mock private RaceMapper            raceMapper;
    @Mock private EmailService          emailService;

    @InjectMocks
    private GroupAdminService groupAdminService;

    private User creator;
    private User member;
    private Group group;

    private User countsUser;
    private Group groupA;
    private Group groupB;
    private GroupMember adminMemberA;
    private GroupMember adminMemberB;
    private GroupMember regularMember;

    @BeforeEach
    void setUp() {
        creator = User.builder()
                .id(1L).username("creator").email("c@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        member = User.builder()
                .id(2L).username("member").email("m@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        group = Group.builder()
                .id(10L).name("Test Group").description("A group")
                .inviteCode("TESTCODE").createdBy(creator)
                .build();

        // Fixtures for getCounts (badge counts) tests — separate ids from the
        // membership-admin fixtures above since they exercise a different scenario.
        countsUser = User.builder()
                .id(1L).username("alice").email("alice@test.com")
                .password("encoded").role(User.Role.USER)
                .build();

        groupA = Group.builder().id(12L).name("Groupe A").build();
        groupB = Group.builder().id(17L).name("Groupe B").build();

        adminMemberA = GroupMember.builder()
                .id(10L).user(countsUser).group(groupA)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .status(MemberStatus.ACTIVE)
                .build();

        adminMemberB = GroupMember.builder()
                .id(11L).user(countsUser).group(groupB)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .status(MemberStatus.ACTIVE)
                .build();

        regularMember = GroupMember.builder()
                .id(12L).user(countsUser).group(groupA)
                .role(GroupMember.GroupRole.MEMBER)
                .status(MemberStatus.ACTIVE)
                .build();
    }

    // ── approveApplication ────────────────────────────────────────────────────

    @Test
    void approveApplication_shouldThrowWhenApplicantNotFound() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupAdminService.approveApplication(10L, 2L, "creator"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Application not found");
    }

    @Test
    void approveApplication_shouldThrowWhenApplicantAlreadyActive() {
        GroupMember alreadyActive = activeMember(member);

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(alreadyActive));

        assertThatThrownBy(() -> groupAdminService.approveApplication(10L, 2L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already an active member");
    }

    @Test
    void approveApplication_shouldSetStatusToActive() {
        GroupMember pendingMember = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .status(MemberStatus.PENDING)
                .build();

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMember));
        when(groupMemberRepository.save(pendingMember)).thenReturn(pendingMember);

        groupAdminService.approveApplication(10L, 2L, "creator");

        assertThat(pendingMember.getStatus()).isEqualTo(MemberStatus.ACTIVE);
        verify(groupMemberRepository).save(pendingMember);
    }

    // ── rejectApplication ─────────────────────────────────────────────────────

    @Test
    void rejectApplication_shouldDeletePendingMembership() {
        GroupMember pendingMember = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .status(MemberStatus.PENDING)
                .build();

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMember));

        groupAdminService.rejectApplication(10L, 2L, "creator");

        verify(groupMemberRepository).delete(pendingMember);
    }

    // ── updateInfo ────────────────────────────────────────────────────────────

    @Test
    void updateInfo_shouldThrowWhenRequesterIsNotGroupAdmin() {
        when(groupService.findUser("member")).thenReturn(member);
        when(groupMemberGuard.requireGroupAdmin(10L, 2L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> groupAdminService.updateInfo(10L, "New name", "New description", "member"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void updateInfo_shouldUpdateNameAndDescription() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupRepository.save(group)).thenReturn(group);
        when(groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true))
                .thenReturn(com.pronocore.dto.response.GroupResponse.builder().id(10L).name("New name").build());

        groupAdminService.updateInfo(10L, " New name ", " New description ", "creator");

        assertThat(group.getName()).isEqualTo("New name");
        assertThat(group.getDescription()).isEqualTo("New description");
        verify(groupRepository).save(group);
    }

    @Test
    void updateInfo_shouldClearDescriptionWhenBlank() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupRepository.save(group)).thenReturn(group);
        when(groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true))
                .thenReturn(com.pronocore.dto.response.GroupResponse.builder().id(10L).build());

        groupAdminService.updateInfo(10L, "Test Group", "   ", "creator");

        assertThat(group.getDescription()).isNull();
    }

    // ── updateInviteCode ──────────────────────────────────────────────────────

    @Test
    void updateInviteCode_shouldThrowWhenRequesterIsNotGroupAdmin() {
        when(groupService.findUser("member")).thenReturn(member);
        when(groupMemberGuard.requireGroupAdmin(10L, 2L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> groupAdminService.updateInviteCode(10L, "CUSTOM01", "member"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void updateInviteCode_shouldGenerateRandomCodeWhenBlank() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupService.generateUniqueCode()).thenReturn("RANDOM99");
        when(groupRepository.save(group)).thenReturn(group);
        when(groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true))
                .thenReturn(com.pronocore.dto.response.GroupResponse.builder().id(10L).build());

        groupAdminService.updateInviteCode(10L, "  ", "creator");

        assertThat(group.getInviteCode()).isEqualTo("RANDOM99");
    }

    @Test
    void updateInviteCode_shouldSetNormalizedCustomCode() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupRepository.existsByInviteCode("CUSTOM01")).thenReturn(false);
        when(groupRepository.save(group)).thenReturn(group);
        when(groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true))
                .thenReturn(com.pronocore.dto.response.GroupResponse.builder().id(10L).build());

        groupAdminService.updateInviteCode(10L, " custom01 ", "creator");

        assertThat(group.getInviteCode()).isEqualTo("CUSTOM01");
    }

    @Test
    void updateInviteCode_shouldThrowWhenCodeAlreadyUsed() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupRepository.existsByInviteCode("TAKEN123")).thenReturn(true);

        assertThatThrownBy(() -> groupAdminService.updateInviteCode(10L, "TAKEN123", "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("déjà utilisé");
    }

    @Test
    void updateInviteCode_shouldThrowWhenCodeFormatInvalid() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);

        assertThatThrownBy(() -> groupAdminService.updateInviteCode(10L, "ab", "creator"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("4 et 20");
    }

    @Test
    void updateInviteCode_shouldAllowReSettingSameCode() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(groupRepository.save(group)).thenReturn(group);
        when(groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true))
                .thenReturn(com.pronocore.dto.response.GroupResponse.builder().id(10L).build());

        groupAdminService.updateInviteCode(10L, "TESTCODE", "creator");

        assertThat(group.getInviteCode()).isEqualTo("TESTCODE");
        verify(groupRepository, never()).existsByInviteCode(anyString());
    }

    // ── promoteMember ─────────────────────────────────────────────────────────

    @Test
    void promoteMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        when(groupService.findUser("member")).thenReturn(member);
        when(groupMemberGuard.requireGroupAdmin(10L, 2L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> groupAdminService.promoteMember(10L, 1L, "member"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void promoteMember_shouldThrowWhenTargetIsPending() {
        GroupMember pendingMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER).status(MemberStatus.PENDING)
                .build();

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMembership));

        assertThatThrownBy(() -> groupAdminService.promoteMember(10L, 2L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("pending applicant");
    }

    @Test
    void promoteMember_shouldSetRoleToGroupAdmin() {
        GroupMember targetMembership = activeMember(member);

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));
        when(groupMemberRepository.save(targetMembership)).thenReturn(targetMembership);

        groupAdminService.promoteMember(10L, 2L, "creator");

        assertThat(targetMembership.getRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);
        verify(groupMemberRepository).save(targetMembership);
    }

    // ── demoteMember ──────────────────────────────────────────────────────────

    @Test
    void demoteMember_shouldThrowWhenDemotingLastActiveAdmin() {
        GroupMember adminMembership = activeAdmin(creator);

        when(groupService.findUser("creator")).thenReturn(creator);
        // demoteMember(groupId, targetUserId=1L, ...) targets the requester itself here
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        // Only one active admin → demotion forbidden
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership));

        assertThatThrownBy(() -> groupAdminService.demoteMember(10L, 1L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least one admin");
    }

    @Test
    void demoteMember_shouldSetRoleToMemberWhenAnotherAdminExists() {
        GroupMember requesterAdmin = activeAdmin(creator);
        GroupMember targetAdmin    = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.GROUP_ADMIN).status(MemberStatus.ACTIVE)
                .build();

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetAdmin));
        // Two admins → demotion is allowed
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(requesterAdmin, targetAdmin));
        when(groupMemberRepository.save(targetAdmin)).thenReturn(targetAdmin);

        groupAdminService.demoteMember(10L, 2L, "creator");

        assertThat(targetAdmin.getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
        verify(groupMemberRepository).save(targetAdmin);
    }

    // ── removeMember ──────────────────────────────────────────────────────────

    @Test
    void removeMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        when(groupService.findUser("member")).thenReturn(member);
        when(groupMemberGuard.requireGroupAdmin(10L, 2L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> groupAdminService.removeMember(10L, 1L, "member"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void removeMember_shouldDeleteTargetMembership() {
        GroupMember targetMembership = activeMember(member);

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));

        groupAdminService.removeMember(10L, 2L, "creator");

        verify(groupMemberRepository).delete(targetMembership);
    }

    // ── getFutureOpenRaces / notifyNewRaces ─────────────────────────────────────

    @Test
    void getFutureOpenRaces_shouldThrowWhenRequesterIsNotGroupAdmin() {
        when(groupService.findUser("member")).thenReturn(member);
        when(groupMemberGuard.requireGroupAdmin(10L, 2L))
                .thenThrow(new AccessDeniedException("Group admin role required"));

        assertThatThrownBy(() -> groupAdminService.getFutureOpenRaces(10L, "member"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void getFutureOpenRaces_shouldReturnMappedFutureRaces() {
        Race race = f1Race(100L);

        when(groupService.findUser("creator")).thenReturn(creator);
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of(race));
        RaceResponse response = RaceResponse.builder().id(100L).name("Grand Prix Test").build();
        when(raceMapper.toResponse(race)).thenReturn(response);

        List<RaceResponse> result = groupAdminService.getFutureOpenRaces(10L, "creator");

        assertThat(result).containsExactly(response);
    }

    @Test
    void notifyNewRaces_shouldThrowWhenNoRequestedRaceMatchesFutureOpenRaces() {
        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> groupAdminService.notifyNewRaces(10L, List.of(999L), "creator"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No matching future open races");
    }

    @Test
    void notifyNewRaces_shouldEmailEveryActiveMemberAboutSelectedRaces() {
        GroupMember adminMembership = activeAdmin(creator);
        GroupMember memberMembership = activeMember(member);
        Race race = f1Race(100L);

        when(groupService.findUser("creator")).thenReturn(creator);
        when(groupService.findGroup(10L)).thenReturn(group);
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of(race));
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership, memberMembership));

        groupAdminService.notifyNewRaces(10L, List.of(100L), "creator");

        verify(emailService).sendGroupNewRacesEmail(creator, group.getName(), creator, List.of(race));
        verify(emailService).sendGroupNewRacesEmail(member, group.getName(), creator, List.of(race));
    }

    // ── getCounts ─────────────────────────────────────────────────────────────
    // (badge counts for group admins — folded in from the former AdminCountsService)

    @Test
    void getCounts_unknownUser_throwsEntityNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupAdminService.getCounts("ghost"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("ghost");
    }

    @Test
    void getCounts_noAdminGroups_returnsAllZeros() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(regularMember));

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        assertThat(result.getPendingApplications()).isZero();
        assertThat(result.getPendingForfeitsPerGroup()).isEmpty();
        assertThat(result.getMissingGagesPerGroup()).isEmpty();
        assertThat(result.getGroupsWithNoBets()).isEmpty();
        assertThat(result.getMatchesWithoutBetsPerGroup()).isEmpty();

        verifyNoInteractions(forfeitRepository, betRepository, dailyGageRepository);
    }

    @Test
    void getCounts_oneAdminGroup_aggregatesCorrectly() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));

        // 2 pending applications in groupA
        when(groupMemberRepository.countPendingByGroupIds(List.of(12L)))
                .thenReturn(List.<Object[]>of(row(12L, 2L)));

        // 3 pending forfeits in groupA
        when(forfeitRepository.countPendingByGroupIds(List.of(12L)))
                .thenReturn(List.<Object[]>of(row(12L, 3L)));

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
        when(betRepository.findGroupIdsWithOpenBets(List.of(12L))).thenReturn(Set.of(12L));

        // 5 upcoming matches not yet open in groupA
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(5L);

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        assertThat(result.getPendingApplications()).isEqualTo(2);
        assertThat(result.getPendingForfeitsPerGroup()).containsEntry(12L, 3);
        // 2 open-bet dates, 1 covered → 1 missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
        // has open bets → false
        assertThat(result.getGroupsWithNoBets()).containsEntry(12L, false);
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 5);
    }

    @Test
    void getCounts_twoAdminGroups_eachGroupIsolated() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA, adminMemberB));

        when(groupMemberRepository.countPendingByGroupIds(List.of(12L, 17L)))
                .thenReturn(List.<Object[]>of(row(12L, 1L)));

        when(forfeitRepository.countPendingByGroupIds(List.of(12L, 17L)))
                .thenReturn(List.<Object[]>of(row(12L, 1L)));

        // groupA has open bets on 2026-06-14; groupB has none
        Match m1 = match(LocalDateTime.of(2026, 6, 14, 18, 0));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(m1));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(17L)).thenReturn(List.of());

        // groupA covered, groupB not
        DailyGage covered = DailyGage.builder()
                .group(groupA).matchDate(LocalDate.of(2026, 6, 14)).forfeit(forfeit()).build();
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(anyList()))
                .thenReturn(List.of(covered));

        when(betRepository.findGroupIdsWithOpenBets(List.of(12L, 17L))).thenReturn(Set.of(12L));

        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(17L)).thenReturn(16L);

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        assertThat(result.getPendingApplications()).isEqualTo(1);
        assertThat(result.getPendingForfeitsPerGroup()).containsEntry(12L, 1).containsEntry(17L, 0);
        // groupA: 1 date covered → 0 missing; groupB: 0 open-bet dates → 0 missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 0).containsEntry(17L, 0);
        assertThat(result.getGroupsWithNoBets()).containsEntry(12L, false).containsEntry(17L, true);
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 0).containsEntry(17L, 16);
    }

    @Test
    void getCounts_dailyGageWithNullForfeit_notCountedAsCovered() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());
        when(forfeitRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());

        Match m1 = match(LocalDateTime.of(2026, 6, 14, 18, 0));
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(m1));

        // DailyGage exists but forfeit is null (not yet selected)
        DailyGage gageNoForfeit = DailyGage.builder()
                .group(groupA).matchDate(LocalDate.of(2026, 6, 14)).forfeit(null).build();
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L)))
                .thenReturn(List.of(gageNoForfeit));

        when(betRepository.findGroupIdsWithOpenBets(List.of(12L))).thenReturn(Set.of(12L));
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        // No forfeit assigned → still missing
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
    }

    @Test
    void getCounts_sameMatchDateTwice_countedOnce() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());
        when(forfeitRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());

        // Two OPEN-bet matches on the same calendar day (different kick-off times)
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of(
                match(LocalDateTime.of(2026, 6, 14, 16, 0)),
                match(LocalDateTime.of(2026, 6, 14, 20, 0))
        ));
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L))).thenReturn(List.of());
        when(betRepository.findGroupIdsWithOpenBets(List.of(12L))).thenReturn(Set.of(12L));
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(0L);

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        // Two matches same day → only 1 missing date, not 2
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 1);
    }

    @Test
    void getCounts_newMatchesNotOpenedYet_notCountedInMissingGages() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(countsUser));
        when(groupMemberRepository.findByUserIdAndStatus(1L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMemberA));
        when(groupMemberRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());
        when(forfeitRepository.countPendingByGroupIds(List.of(12L))).thenReturn(List.of());

        // No OPEN bets for this group yet (16 matches added but not opened)
        when(betRepository.findDistinctMatchesWithOpenBetsForGroup(12L)).thenReturn(List.of());
        when(dailyGageRepository.findByGroupIdInOrderByMatchDateDesc(List.of(12L))).thenReturn(List.of());
        when(betRepository.findGroupIdsWithOpenBets(List.of(12L))).thenReturn(Set.of());
        when(betRepository.countUpcomingMatchesWithoutBetsForGroup(12L)).thenReturn(16L);

        GroupAdminCountsResponse result = groupAdminService.getCounts("alice");

        // No open bets → no active days → no missing gages
        assertThat(result.getMissingGagesPerGroup()).containsEntry(12L, 0);
        // But 16 matches need to be opened
        assertThat(result.getMatchesWithoutBetsPerGroup()).containsEntry(12L, 16);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private GroupMember activeAdmin(User user) {
        return GroupMember.builder()
                .id(user.getId()).group(group).user(user)
                .role(GroupMember.GroupRole.GROUP_ADMIN).status(MemberStatus.ACTIVE)
                .build();
    }

    private GroupMember activeMember(User user) {
        return GroupMember.builder()
                .id(user.getId()).group(group).user(user)
                .role(GroupMember.GroupRole.MEMBER).status(MemberStatus.ACTIVE)
                .build();
    }

    private Race f1Race(Long id) {
        Competition f1 = Competition.builder().id(2L).name("Formule 1 2026").build();
        return Race.builder().id(id).name("Grand Prix Test").round(5)
                .qualifyingDate(LocalDateTime.now().plusDays(1))
                .raceDate(LocalDateTime.now().plusDays(2))
                .competition(f1)
                .build();
    }

    private Forfeit forfeit() {
        return Forfeit.builder().id((long) (Math.random() * 10000))
                .title("Gage test").active(false).build();
    }

    private Match match(LocalDateTime dateTime) {
        return Match.builder().id((long) (Math.random() * 10000))
                .teamA(Team.builder().id(1L).name("A").build())
                .teamB(Team.builder().id(2L).name("B").build())
                .matchDate(dateTime).build();
    }

    private Object[] row(Long groupId, Long count) {
        return new Object[] { groupId, count };
    }
}
