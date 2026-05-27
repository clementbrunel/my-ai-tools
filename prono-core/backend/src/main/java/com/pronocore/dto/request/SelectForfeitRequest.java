package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SelectForfeitRequest {

    @NotNull
    private Long forfeitId;
}
