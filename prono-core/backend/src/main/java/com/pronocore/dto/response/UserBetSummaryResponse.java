package com.pronocore.dto.response;

import com.pronocore.entity.Bet;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBetSummaryResponse {

    private Long participationId;
    private Long betId;
    private String betTitle;
    private String matchTeamA;
    private String matchTeamB;
    private LocalDateTime matchDate;
    private Bet.Status betStatus;
    private int betPoints;
    private String chosenOption;
    private String winningOption;
    private int pointsEarned;
    private LocalDateTime participatedAt;
}
