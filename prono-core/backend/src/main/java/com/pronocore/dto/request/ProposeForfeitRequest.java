package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ProposeForfeitRequest {

    @NotBlank
    private String title;

    @NotBlank
    private String description;

    private String category = "General";

    /** The group this gage is added to (kept private to that group). */
    @NotNull(message = "groupId is required")
    private Long groupId;
}
