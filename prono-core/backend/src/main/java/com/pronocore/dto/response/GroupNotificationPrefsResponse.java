package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupNotificationPrefsResponse {

    /** Raw override for this group — null means "inherit the user's global default". */
    private Boolean emailReminderEnabled;

    /** Raw override for this group — null means "inherit the user's global default". */
    private Boolean emailGageEnabled;

    /** Override resolved against the user's global default — what actually gates sending. */
    private boolean effectiveEmailReminderEnabled;

    private boolean effectiveEmailGageEnabled;
}
