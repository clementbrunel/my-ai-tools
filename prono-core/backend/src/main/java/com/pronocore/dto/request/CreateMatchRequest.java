package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateMatchRequest {

    @NotBlank(message = "Team A is required")
    private String teamA;

    @NotBlank(message = "Team B is required")
    private String teamB;

    @NotNull(message = "Match date is required")
    private LocalDateTime matchDate;

    @NotBlank(message = "Competition is required")
    private String competition = "FIFA World Cup 2026";

    @NotBlank(message = "Round is required")
    private String round = "Group Stage";
}
