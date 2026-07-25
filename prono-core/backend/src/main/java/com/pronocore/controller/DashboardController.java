package com.pronocore.controller;

import com.pronocore.dto.response.DashboardStatsResponse;
import com.pronocore.entity.Sport;
import com.pronocore.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Dashboard statistics endpoints")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    @Operation(summary = "Get dashboard stats for the authenticated user (optionally filtered by sport code: FOOT | F1)")
    public ResponseEntity<DashboardStatsResponse> getStats(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false, defaultValue = "FOOT") String sport) {
        return ResponseEntity.ok(dashboardService.getStats(userDetails.getUsername(), parseSport(sport)));
    }

    /** The API carries a plain sport code — parsed here, never the entity enum in the signature. */
    private Sport parseSport(String code) {
        try {
            return Sport.valueOf(code.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Sport inconnu : " + code + " (attendu FOOT ou F1)");
        }
    }
}
