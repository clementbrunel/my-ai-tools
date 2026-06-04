package com.pronocore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class JoinGroupRequest {

    @NotBlank
    private String inviteCode;
}
