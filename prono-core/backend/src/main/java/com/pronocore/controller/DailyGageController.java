package com.pronocore.controller;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.dto.request.SelectForfeitRequest;
import com.pronocore.dto.request.VoteRequest;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.service.DailyGageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/daily-gages")
@RequiredArgsConstructor
@Tag(name = "Daily Gages", description = "Per-day gage selection, voting, and auto-settlement")
public class DailyGageController {

    private final DailyGageService dailyGageService;

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    @GetMapping
    @Operation(summary = "List all daily gages (most recent first)")
    public ResponseEntity<List<DailyGageResponse>> getAllDailyGages() {
        return ResponseEntity.ok(dailyGageService.getAllDailyGages());
    }

    @GetMapping("/group/{groupId}")
    @Operation(summary = "List daily gages for a specific group (member only)")
    public ResponseEntity<List<DailyGageResponse>> getDailyGagesByGroup(@PathVariable Long groupId) {
        return ResponseEntity.ok(dailyGageService.getDailyGagesByGroup(groupId));
    }

    @GetMapping("/date/{date}")
    @Operation(summary = "Get the caller's group gages for a specific date (format: yyyy-MM-dd)")
    public ResponseEntity<List<DailyGageResponse>> getDailyGagesByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(dailyGageService.getDailyGagesByDate(date));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get daily gage by ID (must belong to one of the caller's groups)")
    public ResponseEntity<DailyGageResponse> getDailyGageById(@PathVariable Long id) {
        return ResponseEntity.ok(dailyGageService.getDailyGageById(id));
    }

    // ---------------------------------------------------------------
    // Group-admin commands (authorisation enforced in the service)
    // ---------------------------------------------------------------

    @PostMapping
    @Operation(summary = "Create a daily gage for a calendar day in a group (group admin only)")
    public ResponseEntity<DailyGageResponse> createDailyGage(@RequestBody CreateDailyGageRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(dailyGageService.createDailyGage(req));
    }

    @PutMapping("/{id}/select")
    @Operation(summary = "Select the forfeit directly in DIRECT mode (group admin only)")
    public ResponseEntity<DailyGageResponse> selectForfeitDirectly(
            @PathVariable Long id,
            @RequestBody SelectForfeitRequest req) {
        return ResponseEntity.ok(dailyGageService.selectForfeitDirectly(id, req.getForfeitId()));
    }

    @PostMapping("/{id}/candidates")
    @Operation(summary = "Add a candidate to the VOTE pool (group admin only)")
    public ResponseEntity<DailyGageResponse> addCandidate(
            @PathVariable Long id,
            @RequestBody SelectForfeitRequest req) {
        return ResponseEntity.ok(dailyGageService.addCandidate(id, req.getForfeitId()));
    }

    @DeleteMapping("/{id}/candidates/{forfeitId}")
    @Operation(summary = "Remove a candidate from the VOTE pool (group admin only)")
    public ResponseEntity<DailyGageResponse> removeCandidate(
            @PathVariable Long id,
            @PathVariable Long forfeitId) {
        return ResponseEntity.ok(dailyGageService.removeCandidate(id, forfeitId));
    }

    // ---------------------------------------------------------------
    // Player vote
    // ---------------------------------------------------------------

    @PostMapping("/{id}/vote")
    @Operation(summary = "Cast/change/remove vote on a candidate (vote: +1, -1, or 0 to remove)")
    public ResponseEntity<DailyGageResponse> vote(
            @PathVariable Long id,
            @RequestBody VoteRequest req) {
        return ResponseEntity.ok(dailyGageService.vote(id, req.getForfeitId(), req.getVote()));
    }
}
