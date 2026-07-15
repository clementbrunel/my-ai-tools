package com.pronocore.service;

import com.pronocore.dto.request.CreateGroupRequest;
import com.pronocore.dto.request.JoinGroupRequest;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
import com.pronocore.dto.response.RaceResponse;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.GroupMember.MemberStatus;
import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.mapper.RaceMapper;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.GroupRepository;
import com.pronocore.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock private GroupRepository       groupRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private UserRepository        userRepository;
    @Mock private BetRepository         betRepository;
    @Mock private RaceMapper            raceMapper;
    @Mock private EmailService          emailService;

    @InjectMocks
    private GroupService groupService;

    private User creator;
    private User member;
    private Group group;

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
    }

    // ── createGroup ───────────────────────────────────────────────────────────

    @Test
    void createGroup_shouldSaveGroupAndAssignCreatorAsGroupAdmin() {
        CreateGroupRequest req = new CreateGroupRequest();
        req.setName("Test Group");
        req.setDescription("A group");

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupRepository.existsByInviteCode(anyString())).thenReturn(false);
        when(groupRepository.save(any(Group.class))).thenAnswer(inv -> {
            Group g = inv.getArgument(0);
            g.setId(10L);
            return g;
        });
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        // toResponse(group, GROUP_ADMIN, true) reads active and pending members
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE)).thenReturn(List.of());
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.PENDING)).thenReturn(List.of());

        GroupResponse result = groupService.createGroup(req, "creator");

        assertThat(result.getName()).isEqualTo("Test Group");
        assertThat(result.getCurrentUserRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);

        ArgumentCaptor<GroupMember> memberCaptor = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberRepository).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().getRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);
        assertThat(memberCaptor.getValue().getStatus()).isEqualTo(MemberStatus.ACTIVE);
        assertThat(memberCaptor.getValue().getUser()).isEqualTo(creator);
    }

    @Test
    void createGroup_shouldRetryInviteCodeUntilUnique() {
        CreateGroupRequest req = new CreateGroupRequest();
        req.setName("Group");
        req.setDescription("desc");

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupRepository.existsByInviteCode(anyString()))
                .thenReturn(true)   // first attempt taken
                .thenReturn(false); // second attempt free
        when(groupRepository.save(any(Group.class))).thenAnswer(inv -> {
            Group g = inv.getArgument(0);
            g.setId(10L);
            return g;
        });
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE)).thenReturn(List.of());
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.PENDING)).thenReturn(List.of());

        groupService.createGroup(req, "creator");

        verify(groupRepository, atLeast(2)).existsByInviteCode(anyString());
    }

    // ── joinGroup ─────────────────────────────────────────────────────────────

    @Test
    void joinGroup_shouldThrowWhenInviteCodeIsInvalid() {
        JoinGroupRequest req = new JoinGroupRequest();
        req.setInviteCode("BADCODE");

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findByInviteCode("BADCODE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupService.joinGroup(req, "member"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid invite code");
    }

    @Test
    void joinGroup_shouldThrowWhenAlreadyMember() {
        JoinGroupRequest req = new JoinGroupRequest();
        req.setInviteCode("TESTCODE");

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findByInviteCode("TESTCODE")).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(10L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> groupService.joinGroup(req, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Already a member");
    }

    @Test
    void joinGroup_shouldAddNewMemberWithActiveMemberRole() {
        JoinGroupRequest req = new JoinGroupRequest();
        req.setInviteCode("TESTCODE");

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findByInviteCode("TESTCODE")).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(10L, 2L)).thenReturn(false);
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        // toResponse(group, MEMBER, false) reads only active members
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE)).thenReturn(List.of());

        GroupResponse result = groupService.joinGroup(req, "member");

        assertThat(result.getCurrentUserRole()).isEqualTo(GroupMember.GroupRole.MEMBER);

        ArgumentCaptor<GroupMember> captor = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
        assertThat(captor.getValue().getStatus()).isEqualTo(MemberStatus.ACTIVE);
    }

    // ── applyToGroup ──────────────────────────────────────────────────────────

    @Test
    void applyToGroup_shouldThrowWhenGroupIsPrivate() {
        Group privateGroup = Group.builder()
                .id(10L).name("Secret").createdBy(creator).isPrivate(true).build();

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findById(10L)).thenReturn(Optional.of(privateGroup));

        assertThatThrownBy(() -> groupService.applyToGroup(10L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("private");
    }

    @Test
    void applyToGroup_shouldThrowWhenAlreadyMemberOrApplicant() {
        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findById(10L)).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(10L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> groupService.applyToGroup(10L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Already a member or applicant");
    }

    @Test
    void applyToGroup_shouldCreatePendingMembership() {
        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findById(10L)).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(10L, 2L)).thenReturn(false);
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(groupMemberRepository.countByGroupIdAndStatus(10L, MemberStatus.ACTIVE)).thenReturn(0L);

        groupService.applyToGroup(10L, "member");

        ArgumentCaptor<GroupMember> captor = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(MemberStatus.PENDING);
        assertThat(captor.getValue().getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
    }

    // ── approveApplication ────────────────────────────────────────────────────

    @Test
    void approveApplication_shouldThrowWhenApplicantNotFound() {
        GroupMember adminMembership = activeAdmin(creator);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupService.approveApplication(10L, 2L, "creator"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Application not found");
    }

    @Test
    void approveApplication_shouldThrowWhenApplicantAlreadyActive() {
        GroupMember adminMembership  = activeAdmin(creator);
        GroupMember alreadyActive    = activeMember(member);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(alreadyActive));

        assertThatThrownBy(() -> groupService.approveApplication(10L, 2L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already an active member");
    }

    @Test
    void approveApplication_shouldSetStatusToActive() {
        GroupMember adminMembership = activeAdmin(creator);
        GroupMember pendingMember   = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .status(MemberStatus.PENDING)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMember));
        when(groupMemberRepository.save(pendingMember)).thenReturn(pendingMember);

        groupService.approveApplication(10L, 2L, "creator");

        assertThat(pendingMember.getStatus()).isEqualTo(MemberStatus.ACTIVE);
        verify(groupMemberRepository).save(pendingMember);
    }

    // ── rejectApplication ─────────────────────────────────────────────────────

    @Test
    void rejectApplication_shouldDeletePendingMembership() {
        GroupMember adminMembership = activeAdmin(creator);
        GroupMember pendingMember   = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .status(MemberStatus.PENDING)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMember));

        groupService.rejectApplication(10L, 2L, "creator");

        verify(groupMemberRepository).delete(pendingMember);
    }

    // ── leaveGroup ────────────────────────────────────────────────────────────

    @Test
    void leaveGroup_shouldThrowWhenUserIsNotMember() {
        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupService.leaveGroup(10L, "member"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Not a member");
    }

    @Test
    void leaveGroup_shouldDeleteGroupWhenLastActiveMember() {
        GroupMember adminMembership = activeAdmin(creator);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership));

        groupService.leaveGroup(10L, "creator");

        verify(groupRepository).deleteById(10L);
        verify(groupMemberRepository, never()).delete(adminMembership);
    }

    @Test
    void leaveGroup_shouldThrowWhenOnlyAdminWithOtherActiveMembers() {
        GroupMember adminMembership  = activeAdmin(creator);
        GroupMember memberMembership = activeMember(member);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership, memberMembership));

        assertThatThrownBy(() -> groupService.leaveGroup(10L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("only admin");
    }

    @Test
    void leaveGroup_shouldDeleteMembershipForRegularMember() {
        GroupMember memberMembership = activeMember(member);

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        groupService.leaveGroup(10L, "member");

        verify(groupMemberRepository).delete(memberMembership);
    }

    // ── promoteMember ─────────────────────────────────────────────────────────

    @Test
    void promoteMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        GroupMember memberMembership = activeMember(member);

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> groupService.promoteMember(10L, 1L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void promoteMember_shouldThrowWhenTargetIsPending() {
        GroupMember adminMembership  = activeAdmin(creator);
        GroupMember pendingMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER).status(MemberStatus.PENDING)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(pendingMembership));

        assertThatThrownBy(() -> groupService.promoteMember(10L, 2L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("pending applicant");
    }

    @Test
    void promoteMember_shouldSetRoleToGroupAdmin() {
        GroupMember adminMembership  = activeAdmin(creator);
        GroupMember targetMembership = activeMember(member);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));
        when(groupMemberRepository.save(targetMembership)).thenReturn(targetMembership);

        groupService.promoteMember(10L, 2L, "creator");

        assertThat(targetMembership.getRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);
        verify(groupMemberRepository).save(targetMembership);
    }

    // ── demoteMember ──────────────────────────────────────────────────────────

    @Test
    void demoteMember_shouldThrowWhenDemotingLastActiveAdmin() {
        GroupMember adminMembership = activeAdmin(creator);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        // Only one active admin → demotion forbidden
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership));

        assertThatThrownBy(() -> groupService.demoteMember(10L, 1L, "creator"))
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

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(requesterAdmin));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetAdmin));
        // Two admins → demotion is allowed
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(requesterAdmin, targetAdmin));
        when(groupMemberRepository.save(targetAdmin)).thenReturn(targetAdmin);

        groupService.demoteMember(10L, 2L, "creator");

        assertThat(targetAdmin.getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
        verify(groupMemberRepository).save(targetAdmin);
    }

    // ── removeMember ──────────────────────────────────────────────────────────

    @Test
    void removeMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        GroupMember memberMembership = activeMember(member);

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> groupService.removeMember(10L, 1L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void removeMember_shouldDeleteTargetMembership() {
        GroupMember adminMembership  = activeAdmin(creator);
        GroupMember targetMembership = activeMember(member);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));

        groupService.removeMember(10L, 2L, "creator");

        verify(groupMemberRepository).delete(targetMembership);
    }

    // ── getFutureOpenRaces / notifyNewRaces ─────────────────────────────────────

    @Test
    void getFutureOpenRaces_shouldThrowWhenRequesterIsNotGroupAdmin() {
        GroupMember memberMembership = activeMember(member);

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> groupService.getFutureOpenRaces(10L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void getFutureOpenRaces_shouldReturnMappedFutureRaces() {
        GroupMember adminMembership = activeAdmin(creator);
        Race race = f1Race(100L);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of(race));
        RaceResponse response = RaceResponse.builder().id(100L).name("Grand Prix Test").build();
        when(raceMapper.toResponse(race)).thenReturn(response);

        List<RaceResponse> result = groupService.getFutureOpenRaces(10L, "creator");

        assertThat(result).containsExactly(response);
    }

    @Test
    void notifyNewRaces_shouldThrowWhenNoRequestedRaceMatchesFutureOpenRaces() {
        GroupMember adminMembership = activeAdmin(creator);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupRepository.findById(10L)).thenReturn(Optional.of(group));
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> groupService.notifyNewRaces(10L, List.of(999L), "creator"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No matching future open races");
    }

    @Test
    void notifyNewRaces_shouldEmailEveryActiveMemberAboutSelectedRaces() {
        GroupMember adminMembership = activeAdmin(creator);
        GroupMember memberMembership = activeMember(member);
        Race race = f1Race(100L);

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupRepository.findById(10L)).thenReturn(Optional.of(group));
        when(betRepository.findFutureDistinctRacesWithOpenBetsForGroup(eq(10L), any(LocalDateTime.class)))
                .thenReturn(List.of(race));
        when(groupMemberRepository.findByGroupIdAndStatus(10L, MemberStatus.ACTIVE))
                .thenReturn(List.of(adminMembership, memberMembership));

        groupService.notifyNewRaces(10L, List.of(100L), "creator");

        verify(emailService).sendGroupNewRacesEmail(creator, group.getName(), creator, List.of(race));
        verify(emailService).sendGroupNewRacesEmail(member, group.getName(), creator, List.of(race));
    }

    private Race f1Race(Long id) {
        Competition f1 = Competition.builder().id(2L).name("Formule 1 2026").build();
        return Race.builder().id(id).name("Grand Prix Test").round(5)
                .qualifyingDate(LocalDateTime.now().plusDays(1))
                .raceDate(LocalDateTime.now().plusDays(2))
                .competition(f1)
                .build();
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
}
