package com.pronocore.dto.request;

import com.pronocore.entity.Match;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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

    private String penaltyWinner;

    private Integer penaltyScoreA;

    private Integer penaltyScoreB;
}
