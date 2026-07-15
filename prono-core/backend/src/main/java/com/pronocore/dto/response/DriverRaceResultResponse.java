package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One race of a driver's season history — feeds the driver detail page. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriverRaceResultResponse {

    private Long raceId;
    private String raceName;
    private int round;
    private String countryIso2;
    private LocalDateTime raceDate;
    private Integer position;
    private Integer sprintPosition;
    private boolean pole;
    private boolean fastestLap;
    private boolean dnf;
    /** FIA points earned in this race (race + sprint scales combined). */
    private int points;
}
