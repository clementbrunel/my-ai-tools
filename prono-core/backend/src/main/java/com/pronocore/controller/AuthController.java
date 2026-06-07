package com.pronocore.controller;

import com.pronocore.dto.request.LoginRequest;
import com.pronocore.dto.request.RegisterRequest;
import com.pronocore.dto.request.ResendVerificationRequest;
import com.pronocore.dto.request.VerifyEmailRequest;
import com.pronocore.dto.response.AuthResponse;
import com.pronocore.dto.response.RegisterResponse;
import com.pronocore.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login, registration and email verification endpoints")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user — sends a verification email")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Login and get JWT token (email must be verified)")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/verify-email")
    @Operation(summary = "Verify email address with the token received by email")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request.getToken()));
    }

    @PostMapping("/resend-verification")
    @Operation(summary = "Resend the email verification link")
    public ResponseEntity<Void> resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        authService.resendVerification(request.getEmail());
        return ResponseEntity.noContent().build();
    }
}
