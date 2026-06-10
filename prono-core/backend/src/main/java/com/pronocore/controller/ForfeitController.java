package com.pronocore.controller;

import com.pronocore.dto.request.ProposeForfeitRequest;
import com.pronocore.dto.request.VoteForfeitRequest;
import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
import com.pronocore.service.ForfeitService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
    @Operation(summary = "Get active forfeits visible to the caller (shared + their groups)")
    public ResponseEntity<List<ForfeitResponse>> getAllForfeits(Authentication authentication) {
        return ResponseEntity.ok(forfeitService.getForfeitsForUser(authentication.getName()));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Get all forfeits including inactive (Admin only)")
    public ResponseEntity<List<ForfeitResponse>> getAllForfeitsAdmin() {
        return ResponseEntity.ok(forfeitService.getAllForfeitsAdmin());
    }

    @PostMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Create a new forfeit (Admin only)")
    public ResponseEntity<ForfeitResponse> createForfeit(
            @RequestParam String title,
            @RequestParam String description,
            @RequestParam(defaultValue = "General") String category) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(forfeitService.createForfeit(title, description, category));
    }

    @PostMapping("/propose")
    @Operation(summary = "A player proposes a gage inside one of their groups (kept in that group)")
    public ResponseEntity<ForfeitResponse> proposeForfeit(@Valid @RequestBody ProposeForfeitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(forfeitService.proposeForfeit(req.getGroupId(), req.getTitle(),
                                                    req.getDescription(), req.getCategory()));
    }

    @PostMapping("/{forfeitId}/vote")
    @Operation(summary = "Upvote (+1), downvote (-1), or remove vote (0) on a forfeit")
    public ResponseEntity<ForfeitResponse> voteForfeit(
            @PathVariable Long forfeitId,
            @RequestBody VoteForfeitRequest req) {
        return ResponseEntity.ok(forfeitService.voteForfeit(forfeitId, req.getVote()));
    }

    @PutMapping("/{forfeitId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Update a forfeit's title, description and category (Admin only)")
    public ResponseEntity<ForfeitResponse> updateForfeit(
            @PathVariable Long forfeitId,
            @RequestParam String title,
            @RequestParam String description,
            @RequestParam(defaultValue = "General") String category) {
        return ResponseEntity.ok(forfeitService.updateForfeit(forfeitId, title, description, category));
    }

    @DeleteMapping("/{forfeitId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Soft-delete a forfeit (Admin only)")
    public ResponseEntity<Void> deleteForfeit(@PathVariable Long forfeitId) {
        forfeitService.deleteForfeit(forfeitId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------
    // Group-admin gage management
    // ---------------------------------------------------------------

    @GetMapping("/visible/{groupId}")
    @Operation(summary = "Get shared forfeits + group-specific forfeits visible for selection (group member)")
    public ResponseEntity<List<ForfeitResponse>> getForfeitsVisibleToGroup(@PathVariable Long groupId) {
        return ResponseEntity.ok(forfeitService.getForfeitsVisibleToGroup(groupId));
    }

    @GetMapping("/group/{groupId}")
    @Operation(summary = "Get active group-specific forfeits (group member)")
    public ResponseEntity<List<ForfeitResponse>> getGroupForfeits(@PathVariable Long groupId) {
        return ResponseEntity.ok(forfeitService.getGroupForfeits(groupId));
    }

    @GetMapping("/group/{groupId}/pending")
    @Operation(summary = "Get pending proposed forfeits awaiting approval (group admin)")
    public ResponseEntity<List<ForfeitResponse>> getGroupPendingForfeits(@PathVariable Long groupId) {
        return ResponseEntity.ok(forfeitService.getGroupPendingForfeits(groupId));
    }

    @PatchMapping("/group/{groupId}/{forfeitId}/approve")
    @Operation(summary = "Approve a player-proposed forfeit (group admin)")
    public ResponseEntity<ForfeitResponse> approveGroupForfeit(
            @PathVariable Long groupId, @PathVariable Long forfeitId) {
        return ResponseEntity.ok(forfeitService.approveGroupForfeit(groupId, forfeitId));
    }

    @DeleteMapping("/group/{groupId}/{forfeitId}")
    @Operation(summary = "Reject or delete a group forfeit (group admin)")
    public ResponseEntity<Void> deleteGroupForfeit(
            @PathVariable Long groupId, @PathVariable Long forfeitId) {
        forfeitService.deleteGroupForfeit(groupId, forfeitId);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------
    // Manual assignment (admin)
    // ---------------------------------------------------------------

    @PostMapping("/assign")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
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
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Get gage assignments for a specific user (Admin only)")
    public ResponseEntity<List<UserForfeitResponse>> getUserForfeits(@PathVariable Long userId) {
        return ResponseEntity.ok(forfeitService.getUserForfeits(userId));
    }
}
