package com.pronocore.controller;

import com.pronocore.dto.response.LeaderboardEntryResponse;
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
    @Operation(summary = "Get leaderboard for a specific group")
    @LoggedAt(Level.INFO)
    public ResponseEntity<List<LeaderboardEntryResponse>> getGroupLeaderboard(@PathVariable Long groupId) {
        return ResponseEntity.ok(leaderboardService.getGroupLeaderboard(groupId));
    }
}
