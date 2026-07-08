package com.pronocore.dto.request;

import com.pronocore.entity.Match;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateMatchScoreRequest {

    @NotNull(message = "Score A is required")
    @Min(value = 0, message = "Score cannot be negative")
    private Integer scoreA;

    @NotNull(message = "Score B is required")
    @Min(value = 0, message = "Score cannot be negative")
    private Integer scoreB;

    @NotNull(message = "Status is required")
    private Match.Status status;

    @Pattern(regexp = "^[AB]$", message = "penaltyWinner must be 'A' or 'B'")
    private String penaltyWinner;

    @Min(value = 0, message = "Penalty score cannot be negative")
    private Integer penaltyScoreA;

    @Min(value = 0, message = "Penalty score cannot be negative")
    private Integer penaltyScoreB;

    /** Explicit flag to clear all penalty data (penaltyWinner + scores). */
    private boolean penaltyCleared;
}
