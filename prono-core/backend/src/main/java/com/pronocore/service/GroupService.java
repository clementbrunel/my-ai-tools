package com.pronocore.service;

import com.pronocore.dto.request.CreateGroupRequest;
import com.pronocore.dto.request.JoinGroupRequest;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
import com.pronocore.dto.response.PublicGroupResponse;
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
            .status(GroupMember.MemberStatus.ACTIVE)
            .build();
        groupMemberRepository.save(membership);

        return toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional
    public GroupResponse joinGroup(JoinGroupRequest request, String username) {
        User user = findUser(username);
        Group group = groupRepository.findByInviteCode(request.getInviteCode())
            .orElseThrow(() -> new IllegalArgumentException("Invalid invite code"));

        if (groupMemberRepository.existsByGroupIdAndUserId(group.getId(), user.getId())) {
            throw new IllegalStateException("Already a member of this group");
        }

        // Joining via invite code always results in ACTIVE membership (bypasses approval)
        GroupMember membership = GroupMember.builder()
            .group(group)
            .user(user)
            .role(GroupMember.GroupRole.MEMBER)
            .status(GroupMember.MemberStatus.ACTIVE)
            .build();
        groupMemberRepository.save(membership);

        return toResponse(group, GroupMember.GroupRole.MEMBER, false);
    }

    @Transactional
    public PublicGroupResponse applyToGroup(Long groupId, String username) {
        User user = findUser(username);
        Group group = findGroup(groupId);

        if (group.isPrivate()) {
            throw new IllegalStateException("This group is private and cannot be applied to");
        }
        if (groupMemberRepository.existsByGroupIdAndUserId(groupId, user.getId())) {
            throw new IllegalStateException("Already a member or applicant of this group");
        }

        GroupMember application = GroupMember.builder()
            .group(group)
            .user(user)
            .role(GroupMember.GroupRole.MEMBER)
            .status(GroupMember.MemberStatus.PENDING)
            .build();
        groupMemberRepository.save(application);

        return toPublicResponse(group, GroupMember.MemberStatus.PENDING);
    }

    @Transactional
    public GroupMemberResponse approveApplication(Long groupId, Long targetUserId, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        GroupMember application = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        if (application.getStatus() != GroupMember.MemberStatus.PENDING) {
            throw new IllegalStateException("This user is already an active member");
        }

        application.setStatus(GroupMember.MemberStatus.ACTIVE);
        groupMemberRepository.save(application);
        return toMemberResponse(application);
    }

    @Transactional
    public void rejectApplication(Long groupId, Long targetUserId, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        GroupMember application = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        if (application.getStatus() != GroupMember.MemberStatus.PENDING) {
            throw new IllegalStateException("This user is already an active member");
        }

        groupMemberRepository.delete(application);
    }

    @Transactional
    public GroupResponse updatePrivacy(Long groupId, boolean isPrivate, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        Group group = findGroup(groupId);
        group.setPrivate(isPrivate);
        groupRepository.save(group);

        return toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroup(Long groupId, String username) {
        User user = findUser(username);
        Group group = findGroup(groupId);

        GroupMember membership = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId()).orElse(null);
        GroupMember.GroupRole currentUserRole = (membership != null && membership.getStatus() == GroupMember.MemberStatus.ACTIVE)
            ? membership.getRole() : null;
        boolean isAdmin = currentUserRole == GroupMember.GroupRole.GROUP_ADMIN;

        return toResponse(group, currentUserRole, isAdmin);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> getMyGroups(String username) {
        User user = findUser(username);
        return groupMemberRepository.findByUserIdAndStatus(user.getId(), GroupMember.MemberStatus.ACTIVE).stream()
            .map(m -> toResponse(m.getGroup(), m.getRole(), m.getRole() == GroupMember.GroupRole.GROUP_ADMIN))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PublicGroupResponse> getPublicGroups(String username) {
        User user = findUser(username);
        return groupRepository.findByIsPrivateFalse().stream()
            .map(group -> {
                GroupMember membership = groupMemberRepository
                    .findByGroupIdAndUserId(group.getId(), user.getId()).orElse(null);
                GroupMember.MemberStatus status = membership != null ? membership.getStatus() : null;
                return toPublicResponse(group, status);
            })
            .toList();
    }

    /** PLATFORM_ADMIN only — list all groups. */
    @Transactional(readOnly = true)
    public List<GroupResponse> getAllGroups() {
        return groupRepository.findAll().stream()
            .map(g -> toResponse(g, null, false))
            .toList();
    }

    @Transactional
    public void leaveGroup(Long groupId, String username) {
        User user = findUser(username);
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
            .orElseThrow(() -> new IllegalArgumentException("Not a member of this group"));

        if (member.getStatus() == GroupMember.MemberStatus.ACTIVE) {
            List<GroupMember> activeMembers = groupMemberRepository
                .findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE);

            if (activeMembers.size() == 1) {
                // Last active member: delete the group (cascade handles bets, forfeits, etc.)
                groupRepository.deleteById(groupId);
                return;
            }

            if (member.getRole() == GroupMember.GroupRole.GROUP_ADMIN) {
                long adminCount = activeMembers.stream()
                    .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
                    .count();
                if (adminCount == 1) {
                    throw new IllegalStateException("Cannot leave: you are the only admin. Promote another member first.");
                }
            }
        }

        groupMemberRepository.delete(member);
    }

    @Transactional
    public GroupMemberResponse promoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));
        if (member.getStatus() != GroupMember.MemberStatus.ACTIVE) {
            throw new IllegalStateException("Cannot promote a pending applicant");
        }
        member.setRole(GroupMember.GroupRole.GROUP_ADMIN);
        groupMemberRepository.save(member);
        return toMemberResponse(member);
    }

    @Transactional
    public GroupMemberResponse demoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));

        long adminCount = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
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
        User requester = findUser(requesterUsername);
        assertGroupAdmin(groupId, requesterUsername);

        if (requester.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("Use 'leave group' to remove yourself");
        }

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));

        if (member.getRole() == GroupMember.GroupRole.GROUP_ADMIN) {
            long adminCount = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
                .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
                .count();
            if (adminCount == 1) {
                throw new IllegalStateException("Cannot remove: at least one admin must remain.");
            }
        }

        groupMemberRepository.delete(member);
    }

    // -------------------------------------------------------------------------

    private void assertGroupAdmin(Long groupId, String username) {
        User user = findUser(username);
        GroupMember membership = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
            .orElseThrow(() -> new IllegalArgumentException("Not a member of this group"));
        if (membership.getStatus() != GroupMember.MemberStatus.ACTIVE
                || membership.getRole() != GroupMember.GroupRole.GROUP_ADMIN) {
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

    private GroupResponse toResponse(Group group, GroupMember.GroupRole currentUserRole, boolean includeAdminData) {
        List<GroupMember> activeMembers = groupMemberRepository.findByGroupIdAndStatus(group.getId(), GroupMember.MemberStatus.ACTIVE);
        List<GroupMemberResponse> pendingApplications = null;
        if (includeAdminData) {
            pendingApplications = groupMemberRepository
                .findByGroupIdAndStatus(group.getId(), GroupMember.MemberStatus.PENDING)
                .stream().map(this::toMemberResponse).toList();
        }
        return GroupResponse.builder()
            .id(group.getId())
            .name(group.getName())
            .description(group.getDescription())
            .inviteCode(group.getInviteCode())
            .isPrivate(group.isPrivate())
            .createdByUsername(group.getCreatedBy().getUsername())
            .createdByDisplayName(group.getCreatedBy().getDisplayName())
            .memberCount(activeMembers.size())
            .members(activeMembers.stream().map(this::toMemberResponse).toList())
            .pendingApplications(pendingApplications)
            .createdAt(group.getCreatedAt())
            .currentUserRole(currentUserRole)
            .build();
    }

    private PublicGroupResponse toPublicResponse(Group group, GroupMember.MemberStatus currentUserStatus) {
        long memberCount = groupMemberRepository.countByGroupIdAndStatus(group.getId(), GroupMember.MemberStatus.ACTIVE);
        return PublicGroupResponse.builder()
            .id(group.getId())
            .name(group.getName())
            .description(group.getDescription())
            .isPrivate(group.isPrivate())
            .createdByUsername(group.getCreatedBy().getUsername())
            .createdByDisplayName(group.getCreatedBy().getDisplayName())
            .memberCount((int) memberCount)
            .createdAt(group.getCreatedAt())
            .currentUserStatus(currentUserStatus)
            .build();
    }

    private GroupMemberResponse toMemberResponse(GroupMember m) {
        return GroupMemberResponse.builder()
            .id(m.getId())
            .userId(m.getUser().getId())
            .username(m.getUser().getUsername())
            .displayName(m.getUser().getDisplayName())
            .avatarUrl(m.getUser().getAvatarUrl())
            .role(m.getRole())
            .status(m.getStatus())
            .joinedAt(m.getJoinedAt())
            .build();
    }
}
