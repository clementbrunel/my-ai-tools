package com.pronocore.controller;

import com.pronocore.aspect.LoggedAt;
import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.dto.response.RaceResponse;
import com.pronocore.service.F1RaceService;
import com.pronocore.service.f1.F1SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.event.Level;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Platform-admin F1 endpoints — /api/admin/** is guarded by SecurityConfig. */
@RestController
@RequestMapping("/api/admin/f1")
@RequiredArgsConstructor
@Tag(name = "F1 Admin", description = "Race results entry and settlement")
public class F1AdminController {

    private final F1RaceService f1RaceService;
    private final F1SyncService f1SyncService;

    @PostMapping("/sync/{season}")
    @Operation(summary = "Import calendar, entry list and results from jolpica-f1, settling finished races")
    @LoggedAt(Level.INFO)
    public ResponseEntity<String> sync(@PathVariable int season) {
        return ResponseEntity.ok(f1SyncService.syncSeason(season));
    }

    @PostMapping("/races/{raceId}/results")
    @Operation(summary = "Enter (or correct) the full classification of a race and settle all its bets")
    @LoggedAt(Level.INFO)
    public ResponseEntity<RaceResponse> enterResults(@PathVariable Long raceId,
                                                     @Valid @RequestBody EnterRaceResultsRequest request) {
        return ResponseEntity.ok(f1RaceService.enterResults(raceId, request));
    }
}
