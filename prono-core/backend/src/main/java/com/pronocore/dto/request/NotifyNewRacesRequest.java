package com.pronocore.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** Request from a group leader to notify active group members about newly opened F1 races. */
@Data
public class NotifyNewRacesRequest {

    @NotEmpty(message = "raceIds is required")
    private List<Long> raceIds;
}
