package com.pronocore.dto.response;

import com.pronocore.entity.GroupMember;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupResponse {

    private Long id;
    private String name;
    private String description;
    private String inviteCode;
    private String createdByUsername;
    private int memberCount;
    private List<GroupMemberResponse> members;
    private LocalDateTime createdAt;

    /** Role of the requesting user within this group (null if not a member). */
    private GroupMember.GroupRole currentUserRole;
}
