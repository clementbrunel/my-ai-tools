package com.pronocore.controller;

import com.pronocore.dto.request.ForgotPasswordRequest;
import com.pronocore.dto.request.LoginRequest;
import com.pronocore.dto.request.RegisterRequest;
import com.pronocore.dto.request.ResendVerificationRequest;
import com.pronocore.dto.request.ResetPasswordRequest;
import com.pronocore.dto.request.VerifyEmailRequest;
import com.pronocore.dto.response.AuthResponse;
import com.pronocore.dto.response.RegisterResponse;
import com.pronocore.service.AuthService;
import com.pronocore.service.PasswordResetService;
import com.pronocore.aspect.LoggedAt;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.event.Level;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login, registration, email verification and password reset endpoints")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user — sends a verification email")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Login and get JWT token (email must be verified)")
    @LoggedAt(Level.INFO)
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

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a password reset link")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.initiateReset(request.getEmail());
        // Always return 200 to prevent user enumeration
        return ResponseEntity.ok(Map.of("message",
                "Si cet email est associé à un compte, vous recevrez un lien de réinitialisation."));
    }

    @GetMapping("/reset-password/validate")
    @Operation(summary = "Check whether a reset token is still valid")
    public ResponseEntity<Map<String, Object>> validateResetToken(@RequestParam String token) {
        boolean valid = passwordResetService.validateToken(token);
        return ResponseEntity.ok(Map.of("valid", valid));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password using a valid token")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Mot de passe réinitialisé avec succès."));
    }
}
