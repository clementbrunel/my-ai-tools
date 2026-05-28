package com.pronocore.controller;

import com.pronocore.dto.request.CreateBetRequest;
import com.pronocore.dto.request.ParticipateRequest;
import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
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
    @Operation(summary = "Get all bets")
    public ResponseEntity<List<BetResponse>> getAllBets() {
        return ResponseEntity.ok(betService.getAllBets());
    }

    @GetMapping("/mine")
    @Operation(summary = "Get bets created by the authenticated user")
    public ResponseEntity<List<BetResponse>> getMyBets(Authentication authentication) {
        return ResponseEntity.ok(betService.getMyBets(authentication.getName()));
    }

    @GetMapping("/participated")
    @Operation(summary = "Get bets where the authenticated user has placed a participation")
    public ResponseEntity<List<BetResponse>> getParticipatedBets(Authentication authentication) {
        return ResponseEntity.ok(betService.getParticipatedBets(authentication.getName()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get bet by ID")
    public ResponseEntity<BetResponse> getBet(@PathVariable Long id) {
        return ResponseEntity.ok(betService.getBetById(id));
    }

    @GetMapping("/match/{matchId}")
    @Operation(summary = "Get bets by match")
    public ResponseEntity<List<BetResponse>> getBetsByMatch(@PathVariable Long matchId) {
        return ResponseEntity.ok(betService.getBetsByMatch(matchId));
    }

    @PostMapping
    @Operation(summary = "Create a new bet")
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

    @PutMapping("/{id}/participate")
    @Operation(summary = "Create or update participation — upsert (before kick-off only)")
    public ResponseEntity<BetParticipationResponse> upsertParticipate(
            @PathVariable Long id,
            @Valid @RequestBody ParticipateRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(betService.upsertParticipate(id, request, authentication.getName()));
    }

    @GetMapping("/{id}/participations")
    @Operation(summary = "Get all participations for a bet")
    public ResponseEntity<List<BetParticipationResponse>> getParticipations(@PathVariable Long id) {
        return ResponseEntity.ok(betService.getParticipations(id));
    }

    @PostMapping("/{id}/validate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Validate a bet with winning option (Admin only)")
    public ResponseEntity<BetResponse> validateBet(@PathVariable Long id,
                                                    @RequestParam String winningOption) {
        return ResponseEntity.ok(betService.validateBet(id, winningOption));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Cancel a bet (Admin only)")
    public ResponseEntity<BetResponse> cancelBet(@PathVariable Long id) {
        return ResponseEntity.ok(betService.cancelBet(id));
    }
}
