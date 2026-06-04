package com.pronocore.dto.response;

import com.pronocore.entity.GroupMember;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicGroupResponse {

    private Long id;
    private String name;
    private String description;
    private String createdByUsername;
    private int memberCount;
    private boolean isPrivate;
    private LocalDateTime createdAt;

    /** Current user's membership status: null = not a member/applicant, PENDING = applied, ACTIVE = member. */
    private GroupMember.MemberStatus currentUserStatus;
}
