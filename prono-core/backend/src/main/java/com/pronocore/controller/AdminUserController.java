package com.pronocore.controller;

import com.pronocore.dto.request.AdminUnlockUserRequest;
import com.pronocore.dto.response.UserAdminResponse;
import com.pronocore.dto.response.UserResponse;
import com.pronocore.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - Users", description = "Platform admin endpoints for user management")
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "List all platform users with their group memberships")
    public ResponseEntity<List<UserAdminResponse>> getAllUsersWithGroups() {
        return ResponseEntity.ok(userService.getAllUsersWithGroups());
    }

    @PatchMapping("/{userId}/unlock")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Force emailVerified=true and optionally set a new password — unblocks users stuck in login loop")
    public ResponseEntity<UserResponse> unlockUser(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUnlockUserRequest request) {
        return ResponseEntity.ok(userService.adminUnlockUser(userId, request.getNewPassword()));
    }
}
