package com.pronocore.controller;

import com.pronocore.dto.request.UpdatePasswordRequest;
import com.pronocore.dto.response.UserResponse;
import com.pronocore.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(userService.getCurrentUser(authentication.getName()));
    }

    @GetMapping
    @Operation(summary = "Get all users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PatchMapping("/me/display-name")
    @Operation(summary = "Update display name")
    public ResponseEntity<UserResponse> updateDisplayName(@RequestParam String displayName,
                                                           Authentication authentication) {
        return ResponseEntity.ok(userService.updateDisplayName(authentication.getName(), displayName));
    }

    @PatchMapping("/me/avatar")
    @Operation(summary = "Update avatar URL")
    public ResponseEntity<UserResponse> updateAvatar(@RequestParam String avatarUrl,
                                                      Authentication authentication) {
        return ResponseEntity.ok(userService.updateAvatar(authentication.getName(), avatarUrl));
    }

    @PatchMapping("/me/password")
    @Operation(summary = "Update password")
    public ResponseEntity<Void> updatePassword(@Valid @RequestBody UpdatePasswordRequest request,
                                                Authentication authentication) {
        userService.updatePassword(authentication.getName(), request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.noContent().build();
    }
}
