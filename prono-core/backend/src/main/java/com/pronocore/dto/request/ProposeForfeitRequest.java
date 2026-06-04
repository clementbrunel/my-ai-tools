package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProposeForfeitRequest {

    @NotBlank
    private String title;

    @NotBlank
    private String description;

    private String category = "General";
}
