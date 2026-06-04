package com.pronocore.service;

import com.pronocore.dto.request.CreateGroupRequest;
import com.pronocore.dto.request.JoinGroupRequest;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.User;
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
                .globalScore(0).betsWon(0).forfeitsReceived(0)
                .build();

        member = User.builder()
                .id(2L).username("member").email("m@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(0).betsWon(0).forfeitsReceived(0)
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
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of());

        GroupResponse result = groupService.createGroup(req, "creator");

        assertThat(result.getName()).isEqualTo("Test Group");
        assertThat(result.getCurrentUserRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);

        ArgumentCaptor<GroupMember> memberCaptor = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberRepository).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().getRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);
        assertThat(memberCaptor.getValue().getUser()).isEqualTo(creator);
    }

    @Test
    void createGroup_shouldGenerateUniqueInviteCode() {
        CreateGroupRequest req = new CreateGroupRequest();
        req.setName("Group");
        req.setDescription("desc");

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        // First code attempt is taken, second is free
        when(groupRepository.existsByInviteCode(anyString()))
                .thenReturn(true)
                .thenReturn(false);
        when(groupRepository.save(any(Group.class))).thenAnswer(inv -> {
            Group g = inv.getArgument(0);
            g.setId(10L);
            return g;
        });
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of());

        groupService.createGroup(req, "creator");

        // existsByInviteCode called at least twice (first taken, second free)
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
    void joinGroup_shouldAddNewMemberWithMemberRole() {
        JoinGroupRequest req = new JoinGroupRequest();
        req.setInviteCode("TESTCODE");

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupRepository.findByInviteCode("TESTCODE")).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(10L, 2L)).thenReturn(false);
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of());

        GroupResponse result = groupService.joinGroup(req, "member");

        assertThat(result.getCurrentUserRole()).isEqualTo(GroupMember.GroupRole.MEMBER);

        ArgumentCaptor<GroupMember> captor = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
        assertThat(captor.getValue().getUser()).isEqualTo(member);
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
    void leaveGroup_shouldThrowWhenLastAdminTriesToLeave() {
        GroupMember adminMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        // Only one admin in the group
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of(adminMembership));

        assertThatThrownBy(() -> groupService.leaveGroup(10L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("only admin");
    }

    @Test
    void leaveGroup_shouldDeleteMembershipWhenNotLastAdmin() {
        GroupMember memberMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .build();
        GroupMember adminMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of(adminMembership, memberMembership));

        groupService.leaveGroup(10L, "member");

        verify(groupMemberRepository).delete(memberMembership);
    }

    // ── promoteMember ─────────────────────────────────────────────────────────

    @Test
    void promoteMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        GroupMember memberMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER) // NOT an admin
                .build();

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> groupService.promoteMember(10L, 1L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void promoteMember_shouldSetRoleToGroupAdmin() {
        GroupMember requesterMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();
        GroupMember targetMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(requesterMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));
        when(groupMemberRepository.save(targetMembership)).thenReturn(targetMembership);

        GroupMemberResponse result = groupService.promoteMember(10L, 2L, "creator");

        assertThat(targetMembership.getRole()).isEqualTo(GroupMember.GroupRole.GROUP_ADMIN);
        verify(groupMemberRepository).save(targetMembership);
    }

    // ── demoteMember ──────────────────────────────────────────────────────────

    @Test
    void demoteMember_shouldThrowWhenDemotingLastAdmin() {
        GroupMember adminMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        // assertGroupAdmin passes for the requester
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        // Group has only one admin — this is also the target
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of(adminMembership));

        assertThatThrownBy(() -> groupService.demoteMember(10L, 1L, "creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least one admin");
    }

    @Test
    void demoteMember_shouldSetRoleToMemberWhenAnotherAdminExists() {
        GroupMember requesterMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();
        GroupMember targetMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        // assertGroupAdmin check for requester
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(requesterMembership));
        // target lookup
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));
        // Two admins → demotion is allowed
        when(groupMemberRepository.findByGroupId(10L)).thenReturn(List.of(requesterMembership, targetMembership));
        when(groupMemberRepository.save(targetMembership)).thenReturn(targetMembership);

        groupService.demoteMember(10L, 2L, "creator");

        assertThat(targetMembership.getRole()).isEqualTo(GroupMember.GroupRole.MEMBER);
        verify(groupMemberRepository).save(targetMembership);
    }

    // ── removeMember ──────────────────────────────────────────────────────────

    @Test
    void removeMember_shouldThrowWhenRequesterIsNotGroupAdmin() {
        GroupMember memberMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .build();

        when(userRepository.findByUsername("member")).thenReturn(Optional.of(member));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> groupService.removeMember(10L, 1L, "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group admin role required");
    }

    @Test
    void removeMember_shouldDeleteMembershipWhenRequesterIsGroupAdmin() {
        GroupMember adminMembership = GroupMember.builder()
                .id(1L).group(group).user(creator)
                .role(GroupMember.GroupRole.GROUP_ADMIN)
                .build();
        GroupMember targetMembership = GroupMember.builder()
                .id(2L).group(group).user(member)
                .role(GroupMember.GroupRole.MEMBER)
                .build();

        when(userRepository.findByUsername("creator")).thenReturn(Optional.of(creator));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 1L)).thenReturn(Optional.of(adminMembership));
        when(groupMemberRepository.findByGroupIdAndUserId(10L, 2L)).thenReturn(Optional.of(targetMembership));

        groupService.removeMember(10L, 2L, "creator");

        verify(groupMemberRepository).delete(targetMembership);
    }
}
