package com.pronocore.dto.request;

import com.pronocore.entity.Bet;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateBetRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @NotNull(message = "A match must be associated with a bet")
    private Long matchId;

    @NotNull(message = "Bet type is required")
    private Bet.BetType betType;

    @Min(value = 1, message = "Points must be at least 1")
    private int points = 10;
}
