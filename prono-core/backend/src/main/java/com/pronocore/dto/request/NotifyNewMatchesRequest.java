package com.pronocore.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** Request from a group leader to notify active group members about newly opened matches. */
@Data
public class NotifyNewMatchesRequest {

    @NotEmpty(message = "matchIds is required")
    private List<Long> matchIds;
}
