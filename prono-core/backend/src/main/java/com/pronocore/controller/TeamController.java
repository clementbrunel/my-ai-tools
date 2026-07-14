package com.pronocore.controller;

import com.pronocore.dto.response.MatchResponse;
import com.pronocore.dto.response.TeamResponse;
import com.pronocore.service.TeamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
@Tag(name = "Teams", description = "Team endpoints")
public class TeamController {

    private final TeamService teamService;

    @GetMapping("/{id}")
    @Operation(summary = "Get team by ID")
    public ResponseEntity<TeamResponse> getTeam(@PathVariable Long id) {
        return ResponseEntity.ok(teamService.getTeamById(id));
    }

    @GetMapping("/{id}/matches")
    @Operation(summary = "Get a team's match history and upcoming fixtures, most recent first")
    public ResponseEntity<List<MatchResponse>> getTeamMatches(@PathVariable Long id) {
        return ResponseEntity.ok(teamService.getTeamMatches(id));
    }
}
