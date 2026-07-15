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
    private Integer position;
    private Integer sprintPosition;
    private boolean pole;
    private boolean fastestLap;
    private boolean dnf;
}
