package com.pronocore.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VoteRequest {

    @NotNull
    private Long forfeitId;

    /**
     * +1 (pour), -1 (contre), 0 (retirer le vote).
     */
    @Min(-1) @Max(1)
    private int vote;
}
