package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LinkMatchRequest {
    @NotNull(message = "fixtureId is required")
    private Long fixtureId;
}
