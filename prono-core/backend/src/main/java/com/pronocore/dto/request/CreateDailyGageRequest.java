package com.pronocore.dto.request;

import com.pronocore.entity.DailyGage;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateDailyGageRequest {

    @NotNull
    private Long groupId;

    @NotNull
    private LocalDate matchDate;

    @NotNull
    private DailyGage.Mode mode;
}
