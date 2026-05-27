package com.pronocore.dto.response;

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
    private boolean isActive;

    /** Number of times any player has marked this gage as completed. */
    private int timesCompleted;

    /** Username of the player who proposed this gage (null = admin-created). */
    private String proposedByUsername;
}
