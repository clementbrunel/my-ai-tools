package com.pronocore.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/** Starting grid of a race, entered or corrected by the platform admin. */
@Data
public class EnterQualifyingResultsRequest {

    @NotEmpty
    @Valid
    private List<Entry> results;

    @Data
    public static class Entry {

        @NotNull
        private Long driverId;

        /** Grid position (1 = pole). */
        @NotNull
        @Positive
        private Integer position;

        /** Time in the last knockout session reached (e.g. "1:24.083"); null = not entered. */
        private String time;
    }
}
