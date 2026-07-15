package com.pronocore.controller;

import com.pronocore.aspect.LoggedAt;
import com.pronocore.dto.request.F1PredictionRequest;
import com.pronocore.dto.response.*;
import com.pronocore.service.F1RaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.event.Level;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/f1")
@RequiredArgsConstructor
@Tag(name = "F1", description = "F1 races, predictions and standings")
public class F1Controller {

    private final F1RaceService f1RaceService;

    @GetMapping("/drivers")
    @Operation(summary = "Active drivers with their constructor colors")
    public ResponseEntity<List<DriverResponse>> getDrivers() {
        return ResponseEntity.ok(f1RaceService.getDrivers());
    }

    @GetMapping("/races")
    @Operation(summary = "Season calendar, with open/predicted flags for the caller")
    public ResponseEntity<List<RaceResponse>> getRaces(Authentication authentication) {
        return ResponseEntity.ok(f1RaceService.getRaces(authentication.getName()));
    }

    @GetMapping("/races/{raceId}")
    @Operation(summary = "Race details (with full results once finished)")
    public ResponseEntity<RaceResponse> getRace(@PathVariable Long raceId,
                                                Authentication authentication) {
        return ResponseEntity.ok(f1RaceService.getRace(raceId, authentication.getName()));
    }

    @GetMapping("/races/{raceId}/my-prediction")
    @Operation(summary = "The caller's prediction for a race")
    public ResponseEntity<F1PredictionResponse> getMyPrediction(@PathVariable Long raceId,
                                                                Authentication authentication) {
        return f1RaceService.getMyPrediction(raceId, authentication.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/races/{raceId}/predict")
    @Operation(summary = "Submit or update the caller's Podium+ prediction (pole locks at qualifying)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<F1PredictionResponse> predict(@PathVariable Long raceId,
                                                        @Valid @RequestBody F1PredictionRequest request,
                                                        Authentication authentication) {
        return ResponseEntity.ok(f1RaceService.predict(raceId, request, authentication.getName()));
    }

    @GetMapping("/races/{raceId}/predictions")
    @Operation(summary = "All predictions in the caller's groups (visible once the race started)")
    public ResponseEntity<List<F1PredictionResponse>> getRacePredictions(@PathVariable Long raceId,
                                                                         Authentication authentication) {
        return ResponseEntity.ok(f1RaceService.getRacePredictions(raceId, authentication.getName()));
    }

    @GetMapping("/standings/drivers")
    @Operation(summary = "Driver championship standings (computed from race results, FIA scale)")
    public ResponseEntity<List<F1StandingResponse>> getDriverStandings() {
        return ResponseEntity.ok(f1RaceService.getDriverStandings());
    }

    @GetMapping("/standings/constructors")
    @Operation(summary = "Constructor championship standings")
    public ResponseEntity<List<F1StandingResponse>> getConstructorStandings() {
        return ResponseEntity.ok(f1RaceService.getConstructorStandings());
    }

    @GetMapping("/standings/drivers/history")
    @Operation(summary = "Driver points evolution across the season, top 10 (feeds the chart view)")
    public ResponseEntity<F1StandingHistoryResponse> getDriverStandingsHistory() {
        return ResponseEntity.ok(f1RaceService.getDriverStandingsHistory());
    }

    @GetMapping("/standings/constructors/history")
    @Operation(summary = "Constructor points evolution across the season, top 10 (feeds the chart view)")
    public ResponseEntity<F1StandingHistoryResponse> getConstructorStandingsHistory() {
        return ResponseEntity.ok(f1RaceService.getConstructorStandingsHistory());
    }

    // ---------------------------------------------------------------
    // Group admin — opening races for betting
    // ---------------------------------------------------------------

    @PostMapping("/groups/{groupId}/races/{raceId}/open")
    @Operation(summary = "Open a race for betting in a group (group admin, F1 group required)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<BetResponse> openRace(@PathVariable Long groupId,
                                                @PathVariable Long raceId,
                                                Authentication authentication) {
        return ResponseEntity.ok(f1RaceService.openRaceForBetting(groupId, raceId, authentication.getName()));
    }

    @DeleteMapping("/groups/{groupId}/races/{raceId}/open")
    @Operation(summary = "Close a race for betting in a group (group admin)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<Void> closeRace(@PathVariable Long groupId,
                                          @PathVariable Long raceId,
                                          Authentication authentication) {
        f1RaceService.closeRaceForBetting(groupId, raceId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/groups/{groupId}/competitions/{competitionId}/open")
    @Operation(summary = "Open every race of an F1 competition in a group (group admin, idempotent)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<List<BetResponse>> openCompetitionRaces(@PathVariable Long groupId,
                                                                  @PathVariable Long competitionId,
                                                                  Authentication authentication) {
        return ResponseEntity.ok(
                f1RaceService.openCompetitionRacesForBetting(groupId, competitionId, authentication.getName()));
    }
}
