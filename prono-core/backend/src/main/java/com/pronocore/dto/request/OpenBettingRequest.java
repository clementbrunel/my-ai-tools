package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Request to open a (global) match for betting inside a specific group. */
@Data
public class OpenBettingRequest {

    @NotNull(message = "groupId is required")
    private Long groupId;

    @NotNull(message = "matchId is required")
    private Long matchId;
}
