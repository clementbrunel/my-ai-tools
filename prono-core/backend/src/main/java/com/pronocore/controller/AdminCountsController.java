package com.pronocore.controller;

import com.pronocore.dto.response.AdminCountsResponse;
import com.pronocore.service.AdminCountsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/admin/counts")
@RequiredArgsConstructor
@Tag(name = "Admin - Counts", description = "Aggregated badge counts for group admins")
public class AdminCountsController {

    private final AdminCountsService adminCountsService;

    @GetMapping
    @Operation(summary = "Returns aggregated admin badge counts for the current user's admin groups")
    public ResponseEntity<AdminCountsResponse> getCounts(Principal principal) {
        return ResponseEntity.ok(adminCountsService.getCounts(principal.getName()));
    }
}
