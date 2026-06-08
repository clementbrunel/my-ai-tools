package com.pronocore.controller;

import com.pronocore.dto.response.UserAdminResponse;
import com.pronocore.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - Users", description = "Platform admin endpoints for user management")
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "List all platform users with their group memberships")
    public ResponseEntity<List<UserAdminResponse>> getAllUsersWithGroups() {
        return ResponseEntity.ok(userService.getAllUsersWithGroups());
    }
}
