package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LinkMatchRequest {

    @NotNull(message = "externalId is required")
    private Long externalId;

    /** Code of the external API, e.g. "API-FOOTBALL". Must match external_apis.code. */
    @NotBlank(message = "apiCode is required")
    private String apiCode;
}
