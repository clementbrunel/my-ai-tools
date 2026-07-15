package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class F1PredictionResponse {

    private Long raceId;
    /** Author — filled on the group-visible listings. */
    private String username;
    private String displayName;
    private DriverResponse p1;
    private DriverResponse p2;
    private DriverResponse p3;
    private DriverResponse pole;
    private DriverResponse fastestLap;
    private DriverResponse lastClassified;

    /** Points earned once settled (0 before settlement). */
    private int pointsEarned;
    /** True once the pole pick can no longer change (qualifying started). */
    private boolean poleLocked;
    /** True once nothing can change anymore (race started). */
    private boolean raceLocked;
}
