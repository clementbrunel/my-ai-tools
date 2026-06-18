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
public class UserGroupSummary {
    private Long groupId;
    private String groupName;
    private GroupMember.GroupRole role;
    private GroupMember.MemberStatus status;
    private LocalDateTime joinedAt;
}
