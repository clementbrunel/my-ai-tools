package com.pronocore.controller;

import com.pronocore.service.MatchSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/sync")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class SyncController {

    private final MatchSyncService matchSyncService;

    @PostMapping("/trigger")
    public ResponseEntity<Void> triggerSync() {
        matchSyncService.triggerManualSync();
        return ResponseEntity.ok().build();
    }
}
