package com.pronocore.controller;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.service.ForfeitService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/forfeits")
@RequiredArgsConstructor
@Tag(name = "Forfeits", description = "Forfeit management endpoints")
public class ForfeitController {

    private final ForfeitService forfeitService;

    @GetMapping
    @Operation(summary = "Get all active forfeits")
    public ResponseEntity<List<ForfeitResponse>> getAllForfeits() {
        return ResponseEntity.ok(forfeitService.getAllForfeits());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new forfeit (Admin only)")
    public ResponseEntity<ForfeitResponse> createForfeit(@RequestParam String title,
                                                          @RequestParam String description,
                                                          @RequestParam(defaultValue = "General") String category) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(forfeitService.createForfeit(title, description, category));
    }

    @PostMapping("/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Assign a forfeit to a user (Admin only)")
    public ResponseEntity<Void> assignForfeit(@RequestParam Long userId,
                                               @RequestParam Long forfeitId,
                                               @RequestParam Long assignedById) {
        forfeitService.assignForfeit(userId, forfeitId, assignedById);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PatchMapping("/{userForfeitId}/complete")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Mark a user forfeit as completed (Admin only)")
    public ResponseEntity<Void> completeForfeit(@PathVariable Long userForfeitId) {
        forfeitService.completeForfeit(userForfeitId);
        return ResponseEntity.noContent().build();
    }
}
