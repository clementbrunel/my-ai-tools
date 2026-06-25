package com.pronocore.dto.response;

import com.pronocore.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String username;
    private String displayName;
    private String email;
    private boolean emailVerified;
    private User.Role role;
    private String avatarUrl;
    private boolean emailReminderEnabled;
    private boolean emailGageEnabled;
    private LocalDateTime createdAt;
}
