package com.pronocore.dto.request;

import lombok.Data;

@Data
public class UpdateGroupMemberNotificationPrefsRequest {

    /** Null = inherit the user's global default for this group. */
    private Boolean emailReminderEnabled;

    /** Null = inherit the user's global default for this group. */
    private Boolean emailGageEnabled;
}
