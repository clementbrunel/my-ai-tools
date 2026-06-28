package com.pronocore.controller;

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
    @Operation(summary = "All competition names (roster + matches)")
    public ResponseEntity<List<String>> getAllCompetitions() {
        return ResponseEntity.ok(competitionService.getAllCompetitions());
    }

    @GetMapping("/{competition}/teams")
    @Operation(summary = "Teams registered for a competition (roster + match history)")
    public ResponseEntity<List<String>> getTeams(@PathVariable String competition) {
        return ResponseEntity.ok(competitionService.getTeamsForCompetition(competition));
    }

    @GetMapping("/known-teams")
    @Operation(summary = "All distinct team names known across every competition")
    public ResponseEntity<List<String>> getAllKnownTeams() {
        return ResponseEntity.ok(competitionService.getAllKnownTeams());
    }

    @PostMapping("/{competition}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Add a team to a competition roster (Admin only)")
    public ResponseEntity<Void> addTeam(@PathVariable String competition,
                                        @RequestBody String teamName) {
        competitionService.addTeam(competition, teamName.trim());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{competition}/teams/{teamName}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Remove a team from a competition roster (Admin only)")
    public ResponseEntity<Void> removeTeam(@PathVariable String competition,
                                           @PathVariable String teamName) {
        competitionService.removeTeam(competition, teamName);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{competition}/teams")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Replace the full roster for a competition (Admin only)")
    public ResponseEntity<Void> setTeams(@PathVariable String competition,
                                         @RequestBody List<String> teamNames) {
        competitionService.setTeams(competition, teamNames);
        return ResponseEntity.noContent().build();
    }
}
