package com.pronocore.dto.request;

import com.pronocore.entity.Sport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCompetitionRequest {

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotNull
    private Sport sport;
}
