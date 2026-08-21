package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One row of a football league table, proxied live from football-data.org. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FootStandingResponse {

    private int position;
    private String teamName;
    private String teamShortName;
    private String crestUrl;
    private int played;
    private int won;
    private int draw;
    private int lost;
    private int goalsFor;
    private int goalsAgainst;
    private int goalDifference;
    private int points;
    /** Null outside any highlighted zone. */
    private FootStandingZone zone;
}
