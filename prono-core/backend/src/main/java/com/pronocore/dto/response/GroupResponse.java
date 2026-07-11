package com.pronocore.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pronocore.entity.GroupMember;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

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
    private String createdByDisplayName;
    private int memberCount;
    @JsonProperty("isPrivate")
    private boolean isPrivate;
    private List<GroupMemberResponse> members;
    /** Pending applications — only populated for GROUP_ADMIN. */
    private List<GroupMemberResponse> pendingApplications;
    private LocalDateTime createdAt;

    /** Role of the requesting user within this group (null if not a member). */
    private GroupMember.GroupRole currentUserRole;

    /** Sports this group plays. */
    private Set<com.pronocore.entity.Sport> sports;
}
