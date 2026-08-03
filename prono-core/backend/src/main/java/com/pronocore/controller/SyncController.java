package com.pronocore.controller;

import com.pronocore.dto.request.LinkMatchRequest;
import com.pronocore.dto.response.FixtureCandidateResponse;
import com.pronocore.service.MatchLinkingService;
import com.pronocore.service.MatchSyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/sync")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class SyncController {

    private final MatchLinkingService matchLinkingService;
    private final MatchSyncService    matchSyncService;

    @GetMapping("/candidates/{matchId}")
    public List<FixtureCandidateResponse> getCandidates(@PathVariable Long matchId) {
        return matchLinkingService.findCandidates(matchId);
    }

    @PostMapping("/link/{matchId}")
    public ResponseEntity<Void> linkMatch(@PathVariable Long matchId,
                                          @Valid @RequestBody LinkMatchRequest request) {
        matchLinkingService.linkMatch(matchId, request.getExternalId(), request.getApiCode());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/link/{matchId}")
    public ResponseEntity<Void> unlinkMatch(@PathVariable Long matchId,
                                             @RequestParam(defaultValue = "API-FOOTBALL") String apiCode) {
        matchLinkingService.unlinkMatch(matchId, apiCode);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/trigger")
    public ResponseEntity<Void> triggerSync() {
        matchSyncService.syncMatches();
        return ResponseEntity.ok().build();
    }
}
