package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserForfeitResponse {

    private Long   id;
    private ForfeitResponse forfeit;
    private String assignedByUsername;
    private String assignedByDisplayName;
    private boolean completed;
    private LocalDateTime completedAt;
    private LocalDateTime assignedAt;
}
