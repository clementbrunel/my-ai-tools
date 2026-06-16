package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateEmailGageRequest {

    @NotNull
    private Boolean emailGageEnabled;
}
