package com.pronocore.dto.response;

import com.pronocore.entity.Match;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

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
    private boolean syncLocked;
    private boolean autoSynced;
    /** Map&lt;API_CODE, external_id&gt;, e.g. {"API-FOOTBALL": 12345} */
    private Map<String, Long> externalLinks;
    private Boolean userParticipated;
}
