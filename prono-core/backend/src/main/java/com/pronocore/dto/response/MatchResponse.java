package com.pronocore.dto.response;

import com.pronocore.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchResponse {

    private Long id;
    private TeamResponse teamA;
    private TeamResponse teamB;
    private LocalDateTime matchDate;
    private Integer scoreA;
    private Integer scoreB;
    private Match.Status status;
    private CompetitionResponse competition;
    private String round;
    private Match.MatchPhase phase;
    private String penaltyWinner;
    private Integer penaltyScoreA;
    private Integer penaltyScoreB;
    private Boolean userParticipated;
    private boolean syncLocked;
    private boolean autoSynced;
    private Map<String, Long> externalLinks;
    /** Each team's record in this competition before this match, plus its current league ranking (live
     *  table, matches not yet finished only) — set by the single-match endpoint only, null elsewhere. */
    private TeamSummaryResponse teamASummary;
    private TeamSummaryResponse teamBSummary;
}
