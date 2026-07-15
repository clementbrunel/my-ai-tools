package com.pronocore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateEmailReminderRequest {

    @NotNull
    private Boolean emailReminderEnabled;

    @NotNull
    private Boolean emailGageEnabled;

    @NotNull
    private Boolean emailNewsletterEnabled;
}
