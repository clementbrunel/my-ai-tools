package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One row of the driver or constructor championship standings. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class F1StandingResponse {

    private int rank;
    /** Driver standings only — null in constructor standings. */
    private DriverResponse driver;
    private Long constructorId;
    private String constructorName;
    private String constructorColor;
    private int points;
    private int wins;
    private int podiums;
}
