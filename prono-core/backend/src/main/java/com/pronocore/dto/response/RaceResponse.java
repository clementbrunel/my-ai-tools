package com.pronocore.dto.response;

import com.pronocore.entity.Race;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RaceResponse {

    private Long id;
    private int round;
    private String name;
    private String countryIso2;
    private String circuit;
    private LocalDateTime qualifyingDate;
    private LocalDateTime sprintDate;
    private LocalDateTime raceDate;
    private Race.Status status;
    private Long competitionId;

    /** True if at least one of the caller's active groups opened this race. */
    private boolean openInUserGroups;
    /** True if the caller already submitted a prediction. */
    private boolean userPredicted;

    /** Full classification — only populated once the race is FINISHED. */
    private List<RaceResultResponse> results;
}
