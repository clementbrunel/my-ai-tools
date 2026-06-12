package com.pronocore.dto.response;

import com.pronocore.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAdminResponse {
    private Long id;
    private String username;
    private String displayName;
    private String email;
    private boolean emailVerified;
    private User.Role role;
    private String avatarUrl;
    private int globalScore;
    private int betsWon;
    private int forfeitsReceived;
    private LocalDateTime createdAt;
    private List<UserGroupSummary> groups;
}
