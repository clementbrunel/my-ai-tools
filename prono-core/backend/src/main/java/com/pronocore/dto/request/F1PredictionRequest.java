package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class F1PredictionRequest {

    @NotNull
    private Long p1DriverId;

    @NotNull
    private Long p2DriverId;

    @NotNull
    private Long p3DriverId;

    /** Optional — ignored (kept as-is) once qualifying has started. */
    private Long poleDriverId;

    private Long fastestLapDriverId;

    private Long lastClassifiedDriverId;
}
