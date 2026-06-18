package com.pronocore.controller;

import com.pronocore.dto.response.UserCountsResponse;
import com.pronocore.service.UserCountsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/user/counts")
@RequiredArgsConstructor
@Tag(name = "User - Counts", description = "Aggregated badge counts for the current user")
public class UserCountsController {

    private final UserCountsService userCountsService;

    @GetMapping
    @Operation(summary = "Returns aggregated user badge counts (pending gages, etc.)")
    public ResponseEntity<UserCountsResponse> getCounts(Principal principal) {
        return ResponseEntity.ok(userCountsService.getCounts(principal.getName()));
    }
}
