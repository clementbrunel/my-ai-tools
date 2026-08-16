package com.pronocore.controller;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.entity.Sport;
import com.pronocore.aspect.LoggedAt;
import com.pronocore.service.LeaderboardService;
import io.swagger.v3.oas.annotations.Operation;
import org.slf4j.event.Level;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
@Tag(name = "Leaderboard", description = "Rankings and leaderboard endpoints")
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/group/{groupId}")
    @Operation(summary = "Get leaderboard for a specific group (optionally filtered by sport code: FOOT | F1, "
            + "or narrowed further to a single competition id — competitionId takes priority over sport when both are given)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<List<LeaderboardEntryResponse>> getGroupLeaderboard(
            @PathVariable Long groupId,
            @RequestParam(required = false) String sport,
            @RequestParam(required = false) Long competitionId) {
        return ResponseEntity.ok(leaderboardService.getGroupLeaderboard(groupId, parseSport(sport), competitionId));
    }

    /** The API carries a plain sport code — parsed here, never the entity enum in the signature. */
    private Sport parseSport(String code) {
        if (code == null || code.isBlank()) return null;
        try {
            return Sport.valueOf(code.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Sport inconnu : " + code + " (attendu FOOT ou F1)");
        }
    }
}
