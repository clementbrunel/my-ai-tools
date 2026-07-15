package com.pronocore.controller;

import com.pronocore.dto.request.TestEmailRequest;
import com.pronocore.service.EmailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/email")
@RequiredArgsConstructor
@Tag(name = "Admin – Email", description = "Platform admin endpoints for testing email templates")
public class AdminEmailController {

    private final EmailService emailService;

    @PostMapping("/test")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Send a test email using the specified template to a given address")
    public ResponseEntity<Void> sendTestEmail(@Valid @RequestBody TestEmailRequest request) {
        emailService.sendTestEmail(request.getTargetEmail(), request.getEmailType());
        return ResponseEntity.noContent().build();
    }
}
