package com.pronocore.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/** Full classification of a race, entered by the platform admin. */
@Data
public class EnterRaceResultsRequest {

    @NotEmpty
    @Valid
    private List<Entry> results;

    @Data
    public static class Entry {

        @NotNull
        private Long driverId;

        /**
         * Constructor this driver raced for AT THIS RACE; null = use the driver's current
         * constructor. Set explicitly to record a one-off loan/swap (e.g. a driver covering
         * a single GP for another team) without touching the driver's season-long team.
         */
        private Long constructorId;

        /** Final position; null = not classified. */
        private Integer position;

        /** Sprint position; null = no sprint or keeps the stored value (manual entry). */
        private Integer sprintPosition;

        private boolean pole;

        private boolean fastestLap;

        private boolean dnf;

        /** Winner's total race time, others' gap to the winner; null = not entered. */
        private String time;
    }
}
