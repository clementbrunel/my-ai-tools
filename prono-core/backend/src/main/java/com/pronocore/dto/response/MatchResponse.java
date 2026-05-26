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

    /** Gage optionnel associé au match. */
    private Long   forfeitId;
    private String forfeitTitle;

    /**
     * Bonus de points attribué au plus gros parieur du match
     * (celui qui a participé au plus grand nombre de paris sur ce match).
     */
    private int bettorBonus;
}
