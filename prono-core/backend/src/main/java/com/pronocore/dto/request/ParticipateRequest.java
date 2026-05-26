package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ParticipateRequest {

    @NotBlank(message = "Chosen option is required")
    private String chosenOption;

    private String comment;
}
