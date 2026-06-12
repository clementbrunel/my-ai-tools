package com.pronocore.controller;

import com.pronocore.dto.request.LinkMatchRequest;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.service.MatchLinkingService;
import com.pronocore.service.MatchSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/sync")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@Tag(name = "Sync", description = "Match ↔ api-football.com linking and sync endpoints (Admin only)")
public class SyncController {

    private final MatchLinkingService linkingService;
    private final MatchSyncService    syncService;

    @GetMapping("/candidates/{matchId}")
    @Operation(summary = "Find api-football fixture candidates for a match")
    public ResponseEntity<List<FixtureCandidateResponse>> getCandidates(@PathVariable Long matchId) {
        return ResponseEntity.ok(linkingService.findCandidates(matchId));
    }

    @PostMapping("/link/{matchId}")
    @Operation(summary = "Link a match to an api-football fixture ID")
    public ResponseEntity<Void> linkMatch(@PathVariable Long matchId,
                                          @Valid @RequestBody LinkMatchRequest request) {
        linkingService.linkMatch(matchId, request.getFixtureId());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/link/{matchId}")
    @Operation(summary = "Unlink a match from its api-football fixture ID")
    public ResponseEntity<Void> unlinkMatch(@PathVariable Long matchId) {
        linkingService.unlinkMatch(matchId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/trigger")
    @Operation(summary = "Manually trigger a sync cycle")
    public ResponseEntity<Map<String, String>> triggerSync() {
        syncService.syncMatches();
        return ResponseEntity.ok(Map.of("status", "sync triggered"));
    }
}
