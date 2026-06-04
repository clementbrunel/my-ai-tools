package com.pronocore.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForfeitResponse {

    private Long   id;
    private String title;
    private String description;
    private String category;
    // Force "isActive" as JSON key — without this Jackson strips the "is" prefix
    // from the getter isActive() and serialises the field as "active".
    @JsonProperty("isActive")
    private boolean isActive;

    /** Number of times any player has marked this gage as completed. */
    private int timesCompleted;

    /** Username of the player who proposed this gage (null = admin-created). */
    private String proposedByUsername;

    /** Null = shared gage (visible to all groups). Non-null = belongs to that group only. */
    private Long groupId;
    private String groupName;
}
