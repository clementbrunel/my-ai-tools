package com.pronocore.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminUnlockUserRequest {

    /** Optional: force a new password. If blank, the existing password is kept. */
    @Size(min = 6, message = "New password must be at least 6 characters")
    private String newPassword;
}
