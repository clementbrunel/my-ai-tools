package com.pronocore.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class UpdateGroupGagesEnabledRequest {
    @JsonProperty("gagesEnabled")
    private boolean gagesEnabled;
}
