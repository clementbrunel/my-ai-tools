package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RaceResultResponse {

    private DriverResponse driver;
    /** Constructor the driver raced for AT THIS RACE — may differ from driver.constructorId (loan/swap). */
    private Long constructorId;
    private String constructorName;
    private String constructorColor;
    private Integer position;
    private Integer sprintPosition;
    private boolean pole;
    private boolean fastestLap;
    private boolean dnf;
    private String time;
}
