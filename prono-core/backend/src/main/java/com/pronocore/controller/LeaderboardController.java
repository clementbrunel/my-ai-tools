package com.pronocore.controller;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.service.LeaderboardService;
import io.swagger.v3.oas.annotations.Operation;
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

    @GetMapping
    @Operation(summary = "Get full leaderboard")
    public ResponseEntity<List<LeaderboardEntryResponse>> getLeaderboard() {
        return ResponseEntity.ok(leaderboardService.getLeaderboard());
    }

    @GetMapping("/group/{groupId}")
    @Operation(summary = "Get leaderboard for a specific group")
    public ResponseEntity<List<LeaderboardEntryResponse>> getGroupLeaderboard(@PathVariable Long groupId) {
        return ResponseEntity.ok(leaderboardService.getGroupLeaderboard(groupId));
    }
}
