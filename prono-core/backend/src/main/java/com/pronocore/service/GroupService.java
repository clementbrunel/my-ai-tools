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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public GroupResponse createGroup(CreateGroupRequest request, String username) {
        User creator = findUser(username);

        Group group = Group.builder()
            .name(request.getName())
            .description(request.getDescription())
            .inviteCode(generateUniqueCode())
            .createdBy(creator)
            .build();
        groupRepository.save(group);

        GroupMember membership = GroupMember.builder()
            .group(group)
            .user(creator)
            .role(GroupMember.GroupRole.GROUP_ADMIN)
            .build();
        groupMemberRepository.save(membership);

        return toResponse(group, GroupMember.GroupRole.GROUP_ADMIN);
    }

    @Transactional
    public GroupResponse joinGroup(JoinGroupRequest request, String username) {
        User user = findUser(username);
        Group group = groupRepository.findByInviteCode(request.getInviteCode())
            .orElseThrow(() -> new IllegalArgumentException("Invalid invite code"));

        if (groupMemberRepository.existsByGroupIdAndUserId(group.getId(), user.getId())) {
            throw new IllegalStateException("Already a member of this group");
        }

        GroupMember membership = GroupMember.builder()
            .group(group)
            .user(user)
            .role(GroupMember.GroupRole.MEMBER)
            .build();
        groupMemberRepository.save(membership);

        return toResponse(group, GroupMember.GroupRole.MEMBER);
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroup(Long groupId, String username) {
        User user = findUser(username);
        Group group = findGroup(groupId);

        GroupMember.GroupRole currentUserRole = groupMemberRepository
            .findByGroupIdAndUserId(groupId, user.getId())
            .map(GroupMember::getRole)
            .orElse(null);

        return toResponse(group, currentUserRole);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> getMyGroups(String username) {
        User user = findUser(username);
        return groupMemberRepository.findByUserId(user.getId()).stream()
            .map(m -> toResponse(m.getGroup(), m.getRole()))
            .toList();
    }

    /** PLATFORM_ADMIN only — list all groups. */
    @Transactional(readOnly = true)
    public List<GroupResponse> getAllGroups() {
        return groupRepository.findAll().stream()
            .map(g -> toResponse(g, null))
            .toList();
    }

    @Transactional
    public void leaveGroup(Long groupId, String username) {
        User user = findUser(username);
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
            .orElseThrow(() -> new IllegalArgumentException("Not a member of this group"));

        long adminCount = groupMemberRepository.findByGroupId(groupId).stream()
            .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
            .count();

        if (member.getRole() == GroupMember.GroupRole.GROUP_ADMIN && adminCount == 1) {
            throw new IllegalStateException("Cannot leave: you are the only admin. Promote another member first.");
        }

        groupMemberRepository.delete(member);
    }

    @Transactional
    public GroupMemberResponse promoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));
        member.setRole(GroupMember.GroupRole.GROUP_ADMIN);
        groupMemberRepository.save(member);
        return toMemberResponse(member);
    }

    @Transactional
    public GroupMemberResponse demoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));

        long adminCount = groupMemberRepository.findByGroupId(groupId).stream()
            .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
            .count();
        if (adminCount == 1) {
            throw new IllegalStateException("Cannot demote: at least one admin must remain.");
        }

        member.setRole(GroupMember.GroupRole.MEMBER);
        groupMemberRepository.save(member);
        return toMemberResponse(member);
    }

    @Transactional
    public void removeMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));
        groupMemberRepository.delete(member);
    }

    // -------------------------------------------------------------------------

    private void assertGroupAdmin(Long groupId, String username) {
        User user = findUser(username);
        GroupMember membership = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
            .orElseThrow(() -> new IllegalArgumentException("Not a member of this group"));
        if (membership.getRole() != GroupMember.GroupRole.GROUP_ADMIN) {
            throw new IllegalStateException("Group admin role required");
        }
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
    }

    private Group findGroup(Long groupId) {
        return groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
    }

    private String generateUniqueCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Random rnd = new Random();
        String code;
        do {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
            code = sb.toString();
        } while (groupRepository.existsByInviteCode(code));
        return code;
    }

    private GroupResponse toResponse(Group group, GroupMember.GroupRole currentUserRole) {
        List<GroupMember> members = groupMemberRepository.findByGroupId(group.getId());
        return GroupResponse.builder()
            .id(group.getId())
            .name(group.getName())
            .description(group.getDescription())
            .inviteCode(group.getInviteCode())
            .createdByUsername(group.getCreatedBy().getUsername())
            .memberCount(members.size())
            .members(members.stream().map(this::toMemberResponse).toList())
            .createdAt(group.getCreatedAt())
            .currentUserRole(currentUserRole)
            .build();
    }

    private GroupMemberResponse toMemberResponse(GroupMember m) {
        return GroupMemberResponse.builder()
            .id(m.getId())
            .userId(m.getUser().getId())
            .username(m.getUser().getUsername())
            .avatarUrl(m.getUser().getAvatarUrl())
            .role(m.getRole())
            .joinedAt(m.getJoinedAt())
            .build();
    }
}
