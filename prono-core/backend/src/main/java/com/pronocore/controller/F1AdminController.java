package com.pronocore.controller;

import com.pronocore.aspect.LoggedAt;
import com.pronocore.dto.request.EnterQualifyingResultsRequest;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Platform-admin F1 endpoints — /api/admin/** is guarded by SecurityConfig. */
@RestController
@RequestMapping("/api/admin/f1")
@RequiredArgsConstructor
@Tag(name = "F1 Admin", description = "Race results entry and settlement")
public class F1AdminController {

    private final F1RaceService f1RaceService;
    private final F1SyncService f1SyncService;

    @GetMapping("/races/{raceId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Race detail for the admin tab — includes the imported classification and starting grid "
            + "still awaiting validation (never exposed on the player endpoint)")
    public ResponseEntity<RaceResponse> getRace(@PathVariable Long raceId) {
        return ResponseEntity.ok(f1RaceService.getRaceForAdmin(raceId));
    }

    @PostMapping("/sync")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Import calendar, entry list and results from jolpica-f1 for the configured season, "
            + "settling finished races")
    @LoggedAt(Level.INFO)
    public ResponseEntity<String> sync() {
        return ResponseEntity.ok(f1SyncService.syncSeason());
    }

    @PostMapping("/races/{raceId}/qualifying/resync")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Force re-import of a race's qualifying grid from jolpica — works even once the race "
            + "is finished or the grid validated, for corrections (grid penalty confirmed after the fact). "
            + "A not-yet-validated grid stays a draft; a validated one is replaced and stays validated")
    @LoggedAt(Level.INFO)
    public ResponseEntity<String> resyncQualifying(@PathVariable Long raceId) {
        return ResponseEntity.ok(f1SyncService.syncQualifyingForRace(raceId));
    }

    @PostMapping("/races/{raceId}/qualifying")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Enter (or correct) a race's starting grid and validate it — makes it visible to players "
            + "and protects it from being overwritten by the season sync")
    @LoggedAt(Level.INFO)
    public ResponseEntity<RaceResponse> enterQualifying(@PathVariable Long raceId,
                                                        @Valid @RequestBody EnterQualifyingResultsRequest request) {
        return ResponseEntity.ok(f1RaceService.enterQualifyingResults(raceId, request));
    }

    @PostMapping("/races/{raceId}/results/resync")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Force re-import of a race's full classification from jolpica and re-settle it — works "
            + "even once already finished, for corrections (post-race penalty confirmed after the fact)")
    @LoggedAt(Level.INFO)
    public ResponseEntity<String> resyncResults(@PathVariable Long raceId,
            @RequestParam(defaultValue = "false") boolean notifyByEmail) {
        return ResponseEntity.ok(f1SyncService.syncResultsForRace(raceId, notifyByEmail));
    }

    @PostMapping("/races/{raceId}/results")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Enter (or correct) the full classification of a race and settle all its bets")
    @LoggedAt(Level.INFO)
    public ResponseEntity<RaceResponse> enterResults(@PathVariable Long raceId,
                                                     @Valid @RequestBody EnterRaceResultsRequest request) {
        return ResponseEntity.ok(f1RaceService.enterResults(raceId, request));
    }

    @DeleteMapping("/races/{raceId}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "Delete a race with no bets on it (Admin only) — e.g. a duplicate left over by a calendar resync")
    @LoggedAt(Level.INFO)
    public ResponseEntity<Void> deleteRace(@PathVariable Long raceId) {
        f1RaceService.deleteRace(raceId);
        return ResponseEntity.noContent().build();
    }
}
