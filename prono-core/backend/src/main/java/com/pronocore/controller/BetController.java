package com.pronocore.controller;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.OpenBettingRequest;
import com.pronocore.dto.request.OpenCompetitionRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.dto.response.UserBetSummaryResponse;
import com.pronocore.service.BetService;
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
@RequestMapping("/api/bets")
@RequiredArgsConstructor
@Tag(name = "Bets", description = "Bet management endpoints")
public class BetController {

    private final BetService betService;

    @GetMapping
    @Operation(summary = "Get bets from the authenticated user's groups")
    public ResponseEntity<List<BetResponse>> getAllBets(Authentication authentication) {
        return ResponseEntity.ok(betService.getBetsForUser(authentication.getName()));
    }

    @GetMapping("/participated")
    @Operation(summary = "Get bets where the authenticated user has placed a participation")
    public ResponseEntity<List<BetResponse>> getParticipatedBets(Authentication authentication) {
        return ResponseEntity.ok(betService.getParticipatedBets(authentication.getName()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get bet by ID (must belong to one of the caller's groups)")
    public ResponseEntity<BetResponse> getBet(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(betService.getBetById(id, authentication.getName()));
    }

    @GetMapping("/match/{matchId}")
    @Operation(summary = "Get the caller's group bets for a match")
    public ResponseEntity<List<BetResponse>> getBetsByMatch(@PathVariable Long matchId,
                                                             Authentication authentication) {
        return ResponseEntity.ok(betService.getBetsByMatch(matchId, authentication.getName()));
    }

    @PostMapping("/open")
    @Operation(summary = "Open a match for betting in a group (group admin only)")
    public ResponseEntity<BetResponse> openMatchForBetting(@Valid @RequestBody OpenBettingRequest request,
                                                           Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(betService.openMatchForBetting(request.getGroupId(), request.getMatchId(),
                                                 authentication.getName()));
    }

    @PostMapping("/open-competition")
    @Operation(summary = "Open every match of a competition for betting in a group (group admin only)")
    public ResponseEntity<List<BetResponse>> openCompetitionForBetting(
            @Valid @RequestBody OpenCompetitionRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(betService.openCompetitionForBetting(request.getGroupId(), request.getCompetition(),
                                                       authentication.getName()));
    }

    @DeleteMapping("/match/{matchId}/group/{groupId}")
    @Operation(summary = "Close a match for betting in a group — removes all open bets and participations (group admin only)")
    public ResponseEntity<Void> closeMatchForBetting(@PathVariable Long matchId,
                                                     @PathVariable Long groupId,
                                                     Authentication authentication) {
        betService.closeMatchForBetting(groupId, matchId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @Operation(summary = "Create a custom bet on a match for a group (group admin only)")
    public ResponseEntity<BetResponse> createBet(@Valid @RequestBody CreateBetRequest request,
                                                   Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(betService.createBet(request, authentication.getName()));
    }

    @PostMapping("/{id}/participate")
    @Operation(summary = "Participate in a bet")
    public ResponseEntity<BetParticipationResponse> participate(@PathVariable Long id,
                                                                  @Valid @RequestBody ParticipateRequest request,
                                                                  Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(betService.participate(id, request, authentication.getName()));
    }

    @PutMapping("/match/{matchId}/participate")
    @Operation(summary = "Upsert participation in all open group bets for a match (before kick-off only)")
    public ResponseEntity<List<BetParticipationResponse>> upsertParticipateByMatch(
            @PathVariable Long matchId,
            @Valid @RequestBody ParticipateRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(betService.upsertParticipateByMatch(matchId, request, authentication.getName()));
    }

    @GetMapping("/{id}/participations")
    @Operation(summary = "Get all participations for a bet (must belong to one of the caller's groups)")
    public ResponseEntity<List<BetParticipationResponse>> getParticipations(@PathVariable Long id,
                                                                            Authentication authentication) {
        return ResponseEntity.ok(betService.getParticipations(id, authentication.getName()));
    }

    @GetMapping("/match/{matchId}/participations")
    @Operation(summary = "Get all participations across all group bets for a match")
    public ResponseEntity<List<BetParticipationResponse>> getParticipationsByMatch(
            @PathVariable Long matchId, Authentication authentication) {
        return ResponseEntity.ok(betService.getParticipationsByMatch(matchId, authentication.getName()));
    }

    @GetMapping("/group/{groupId}/user/{userId}/participations")
    @Operation(summary = "Get all bets placed by a user in a group (caller must be a member of that group)")
    public ResponseEntity<List<UserBetSummaryResponse>> getUserBetsInGroup(@PathVariable Long groupId,
                                                                            @PathVariable Long userId,
                                                                            Authentication authentication) {
        return ResponseEntity.ok(betService.getUserBetsInGroup(groupId, userId, authentication.getName()));
    }

    @PostMapping("/{id}/validate")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Validate a bet with winning option (Admin only)")
    public ResponseEntity<BetResponse> validateBet(@PathVariable Long id,
                                                    @RequestParam String winningOption) {
        return ResponseEntity.ok(betService.validateBet(id, winningOption));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Cancel a bet (Admin only)")
    public ResponseEntity<BetResponse> cancelBet(@PathVariable Long id) {
        return ResponseEntity.ok(betService.cancelBet(id));
    }
}
