package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntryResponse {

    private int rank;
    private UserResponse user;
    private int betsWon;
    private int totalPoints;
    private int forfeitsReceived;
}
