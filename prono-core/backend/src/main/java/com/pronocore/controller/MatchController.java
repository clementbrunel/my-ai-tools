package com.pronocore.controller;

import com.pronocore.dto.request.CreateMatchRequest;
import com.pronocore.dto.request.UpdateMatchScoreRequest;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.Match;
import com.pronocore.service.MatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
@Tag(name = "Matches", description = "Match management endpoints")
public class MatchController {

    private final MatchService matchService;

    @GetMapping
    @Operation(summary = "Get all matches")
    public ResponseEntity<List<MatchResponse>> getAllMatches(
            @RequestParam(required = false) Match.Status status) {
        if (status != null) {
            return ResponseEntity.ok(matchService.getMatchesByStatus(status));
        }
        return ResponseEntity.ok(matchService.getAllMatches());
    }

    @GetMapping("/competitions")
    @Operation(summary = "Get active competitions (at least one non-finished match)")
    public ResponseEntity<List<String>> getActiveCompetitions() {
        return ResponseEntity.ok(matchService.getActiveCompetitions());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get match by ID")
    public ResponseEntity<MatchResponse> getMatch(@PathVariable Long id) {
        return ResponseEntity.ok(matchService.getMatchById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Create a new match (Admin only)")
    public ResponseEntity<MatchResponse> createMatch(@Valid @RequestBody CreateMatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matchService.createMatch(request));
    }

    @PatchMapping("/{id}/score")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Update match score (Admin only)")
    public ResponseEntity<MatchResponse> updateScore(@PathVariable Long id,
                                                      @Valid @RequestBody UpdateMatchScoreRequest request) {
        return ResponseEntity.ok(matchService.updateMatchScore(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Delete a match (Admin only)")
    public ResponseEntity<Void> deleteMatch(@PathVariable Long id) {
        matchService.deleteMatch(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/force-settle-all")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Force-recalculate points for ALL bets of a finished match — applies delta only, no double-count (Admin only)")
    public ResponseEntity<Void> forceSettleMatch(@PathVariable Long id) {
        matchService.forceSettleMatch(id);
        return ResponseEntity.noContent().build();
    }

}
