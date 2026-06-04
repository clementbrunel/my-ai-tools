package com.pronocore.controller;

import com.pronocore.dto.request.ProposeForfeitRequest;
import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
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
@Tag(name = "Forfeits", description = "Forfeit library & user gage management")
public class ForfeitController {

    private final ForfeitService forfeitService;

    // ---------------------------------------------------------------
    // Forfeit library
    // ---------------------------------------------------------------

    @GetMapping
    @Operation(summary = "Get all active forfeits")
    public ResponseEntity<List<ForfeitResponse>> getAllForfeits() {
        return ResponseEntity.ok(forfeitService.getAllForfeits());
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get all forfeits including inactive (Admin only)")
    public ResponseEntity<List<ForfeitResponse>> getAllForfeitsAdmin() {
        return ResponseEntity.ok(forfeitService.getAllForfeitsAdmin());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new forfeit (Admin only)")
    public ResponseEntity<ForfeitResponse> createForfeit(
            @RequestParam String title,
            @RequestParam String description,
            @RequestParam(defaultValue = "General") String category) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(forfeitService.createForfeit(title, description, category));
    }

    @PostMapping("/propose")
    @Operation(summary = "Any player can propose a new gage (visible immediately)")
    public ResponseEntity<ForfeitResponse> proposeForfeit(@RequestBody ProposeForfeitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(forfeitService.proposeForfeit(req.getTitle(), req.getDescription(), req.getCategory()));
    }

    @DeleteMapping("/{forfeitId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete a forfeit (Admin only)")
    public ResponseEntity<Void> deleteForfeit(@PathVariable Long forfeitId) {
        forfeitService.deleteForfeit(forfeitId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------
    // Manual assignment (admin)
    // ---------------------------------------------------------------

    @PostMapping("/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Manually assign a forfeit to a user (Admin only)")
    public ResponseEntity<Void> assignForfeit(
            @RequestParam Long userId,
            @RequestParam Long forfeitId,
            @RequestParam Long assignedById) {
        forfeitService.assignForfeit(userId, forfeitId, assignedById);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // ---------------------------------------------------------------
    // Completion (player marks own gage; admin can mark any)
    // ---------------------------------------------------------------

    @PatchMapping("/{userForfeitId}/complete")
    @Operation(summary = "Mark a user forfeit as completed (owner or admin)")
    public ResponseEntity<Void> completeForfeit(@PathVariable Long userForfeitId) {
        forfeitService.completeForfeit(userForfeitId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------
    // User gage history
    // ---------------------------------------------------------------

    @GetMapping("/my")
    @Operation(summary = "Get the caller's gage assignments")
    public ResponseEntity<List<UserForfeitResponse>> getMyForfeits() {
        return ResponseEntity.ok(forfeitService.getMyForfeits());
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get gage assignments for a specific user (Admin only)")
    public ResponseEntity<List<UserForfeitResponse>> getUserForfeits(@PathVariable Long userId) {
        return ResponseEntity.ok(forfeitService.getUserForfeits(userId));
    }
}
