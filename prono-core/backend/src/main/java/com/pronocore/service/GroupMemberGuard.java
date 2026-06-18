package com.pronocore.service;

import com.pronocore.entity.GroupMember;
import com.pronocore.repository.GroupMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GroupMemberGuard {

    private final GroupMemberRepository groupMemberRepository;

    public GroupMember requireActiveMembership(Long groupId, Long userId) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this group"));
        if (member.getStatus() != GroupMember.MemberStatus.ACTIVE) {
            throw new AccessDeniedException("Your membership in this group is pending approval");
        }
        return member;
    }

    public GroupMember requireGroupAdmin(Long groupId, Long userId) {
        GroupMember member = requireActiveMembership(groupId, userId);
        if (member.getRole() != GroupMember.GroupRole.GROUP_ADMIN) {
            throw new AccessDeniedException("Group admin role required");
        }
        return member;
    }
}
