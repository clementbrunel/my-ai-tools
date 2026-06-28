package com.pronocore.dto.request;

import com.pronocore.entity.Match;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateMatchRequest {

    @NotNull(message = "Team A ID is required")
    private Long teamAId;

    @NotNull(message = "Team B ID is required")
    private Long teamBId;

    @NotNull(message = "Match date is required")
    private LocalDateTime matchDate;

    @NotNull(message = "Competition is required")
    private String competition = "FIFA World Cup 2026";

    private String round = "";

    private Match.MatchPhase phase = Match.MatchPhase.POOL;
}
