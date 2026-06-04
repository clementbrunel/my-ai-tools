package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Request to open every match of a competition for betting inside a group. */
@Data
public class OpenCompetitionRequest {

    @NotNull(message = "groupId is required")
    private Long groupId;

    @NotBlank(message = "competition is required")
    private String competition;
}
