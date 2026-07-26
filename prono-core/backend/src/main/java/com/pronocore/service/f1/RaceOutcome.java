package com.pronocore.service.f1;

import com.pronocore.entity.RaceResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Actual outcome of a race, extracted from its results. */
public record RaceOutcome(Map<Integer, Long> driverByPosition,
                           Long poleDriverId,
                           Long fastestLapDriverId,
                           Long lastClassifiedDriverId) {

    public static RaceOutcome from(List<RaceResult> results) {
        Map<Integer, Long> byPosition = new HashMap<>();
        Long pole = null, fastest = null, last = null;
        int maxPosition = -1;
        for (RaceResult rr : results) {
            if (rr.getPosition() != null) {
                byPosition.put(rr.getPosition(), rr.getDriver().getId());
                if (rr.getPosition() > maxPosition) {
                    maxPosition = rr.getPosition();
                    last = rr.getDriver().getId();
                }
            }
            if (rr.isPole()) pole = rr.getDriver().getId();
            if (rr.isFastestLap()) fastest = rr.getDriver().getId();
        }
        return new RaceOutcome(byPosition, pole, fastest, last);
    }

    public Long driverAt(int position) {
        return driverByPosition.get(position);
    }

    public boolean isOnPodium(Long driverId) {
        return Objects.equals(driverId, driverAt(1))
                || Objects.equals(driverId, driverAt(2))
                || Objects.equals(driverId, driverAt(3));
    }
}
