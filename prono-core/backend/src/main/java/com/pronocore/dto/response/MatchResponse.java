package com.pronocore.dto.response;

import com.pronocore.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchResponse {

    private Long id;
    private String teamA;
    private String teamB;
    private LocalDateTime matchDate;
    private Integer scoreA;
    private Integer scoreB;
    private Match.Status status;
    private String competition;
    private String round;
    private Match.MatchPhase phase;
    private String penaltyWinner;
    private Integer penaltyScoreA;
    private Integer penaltyScoreB;
    private Boolean userParticipated;
    private String teamAIso2;
    private String teamBIso2;
}
