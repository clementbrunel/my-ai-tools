package com.pronocore.controller;

import com.pronocore.dto.request.CreateCompetitionRequest;
import com.pronocore.dto.response.CompetitionResponse;
import com.pronocore.dto.response.TeamResponse;
import com.pronocore.entity.Sport;
import com.pronocore.service.CompetitionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
@Tag(name = "Competitions", description = "Competition roster management")
public class CompetitionController {

    private final CompetitionService competitionService;

    @GetMapping
    @Operation(summary = "Competitions, optionally restricted to a set of sports")
    public ResponseEntity<List<CompetitionResponse>> getAllCompetitions(
            @Parameter(description = "Sports to filter by; omit to get every competition")
            @RequestParam(required = false) List<Sport> sport) {
        return ResponseEntity.ok(competitionService.getAllCompetitions(sport));
    }

    @GetMapping("/{competitionId}/teams")
    @Operation(summary = "Teams in a competition roster")
    public ResponseEntity<List<TeamResponse>> getTeams(@PathVariable Long competitionId) {
        return ResponseEntity.ok(competitionService.getTeamsForCompetition(competitionId));
    }

    @PostMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Create a competition (Admin only)")
    public ResponseEntity<Void> createCompetition(@Valid @RequestBody CreateCompetitionRequest request) {
        competitionService.createCompetition(request.getName().trim(), request.getSport());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competitionId}/active")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Activate or deactivate a competition — inactive competitions are hidden by default from the public filters (Admin only)")
    public ResponseEntity<Void> setActive(@PathVariable Long competitionId, @RequestBody boolean active) {
        competitionService.setActive(competitionId, active);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competitionId}/season")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Set (or clear) a competition's season year — used by F1 to derive the jolpica season, "
            + "free-form for other sports (Admin only)")
    public ResponseEntity<Void> setSeason(@PathVariable Long competitionId, @RequestBody(required = false) Integer season) {
        competitionService.setSeason(competitionId, season);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competitionId}/api-football-league-id")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Set (or clear) a competition's api-football league id — required for automatic fixture/score sync (Admin only)")
    public ResponseEntity<Void> setApiFootballLeagueId(@PathVariable Long competitionId,
                                                        @RequestBody(required = false) Integer leagueId) {
        competitionService.setApiFootballLeagueId(competitionId, leagueId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{competitionId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Delete a competition — rejected if it still has matches or races (Admin only)")
    public ResponseEntity<Void> deleteCompetition(@PathVariable Long competitionId) {
        competitionService.deleteCompetition(competitionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/known-teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "All distinct teams across every competition (Admin only)")
    public ResponseEntity<List<TeamResponse>> getAllKnownTeams() {
        return ResponseEntity.ok(competitionService.getAllKnownTeams());
    }

    @PostMapping("/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Find a team by exact name, creating it if it doesn't exist yet (Admin only)")
    public ResponseEntity<TeamResponse> findOrCreateTeam(@RequestBody String teamName) {
        return ResponseEntity.ok(competitionService.findOrCreateTeam(teamName.trim()));
    }

    @PostMapping("/{competitionId}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Add a team to a competition roster (Admin only)")
    public ResponseEntity<Void> addTeam(@PathVariable Long competitionId,
                                        @RequestBody Long teamId) {
        competitionService.addTeam(competitionId, teamId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{competitionId}/teams/{teamId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Remove a team from a competition roster (Admin only)")
    public ResponseEntity<Void> removeTeam(@PathVariable Long competitionId,
                                           @PathVariable Long teamId) {
        competitionService.removeTeam(competitionId, teamId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competitionId}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Replace the full roster for a competition (Admin only)")
    public ResponseEntity<Void> setTeams(@PathVariable Long competitionId,
                                         @RequestBody List<Long> teamIds) {
        competitionService.setTeams(competitionId, teamIds);
        return ResponseEntity.noContent().build();
    }
}
