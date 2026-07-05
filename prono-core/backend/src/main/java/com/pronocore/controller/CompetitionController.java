package com.pronocore.controller;

import com.pronocore.dto.response.TeamResponse;
import com.pronocore.service.CompetitionService;
import io.swagger.v3.oas.annotations.Operation;
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
    @Operation(summary = "All competition names")
    public ResponseEntity<List<String>> getAllCompetitions() {
        return ResponseEntity.ok(competitionService.getAllCompetitions());
    }

    @GetMapping("/{competition}/teams")
    @Operation(summary = "Teams in a competition roster")
    public ResponseEntity<List<TeamResponse>> getTeams(@PathVariable String competition) {
        return ResponseEntity.ok(competitionService.getTeamsForCompetition(competition));
    }

    @PostMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Create a competition (Admin only)")
    public ResponseEntity<Void> createCompetition(@RequestBody String name) {
        competitionService.createCompetition(name.trim());
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

    @PostMapping("/{competition}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Add a team to a competition roster (Admin only)")
    public ResponseEntity<Void> addTeam(@PathVariable String competition,
                                        @RequestBody Long teamId) {
        competitionService.addTeam(competition, teamId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{competition}/teams/{teamId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Remove a team from a competition roster (Admin only)")
    public ResponseEntity<Void> removeTeam(@PathVariable String competition,
                                           @PathVariable Long teamId) {
        competitionService.removeTeam(competition, teamId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competition}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Replace the full roster for a competition (Admin only)")
    public ResponseEntity<Void> setTeams(@PathVariable String competition,
                                         @RequestBody List<Long> teamIds) {
        competitionService.setTeams(competition, teamIds);
        return ResponseEntity.noContent().build();
    }
}
