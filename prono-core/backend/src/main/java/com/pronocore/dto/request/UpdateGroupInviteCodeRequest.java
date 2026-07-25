package com.pronocore.dto.request;

import lombok.Data;

@Data
public class UpdateGroupInviteCodeRequest {

    /** Custom invite code. Leave blank/omit to generate a new random code. */
    private String inviteCode;
}
