package com.pronocore.controller;

import com.pronocore.dto.response.LogPageResponse;
import com.pronocore.service.LogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/logs")
@RequiredArgsConstructor
@Tag(name = "Admin - Logs", description = "Platform admin endpoint for live server logs (in-memory buffer, resets on restart)")
public class AdminLogController {

    private static final int MAX_PAGE_SIZE = 500;

    private final LogService logService;

    @GetMapping
    @Operation(summary = "Paginated, searchable view of the in-memory server log buffer")
    public ResponseEntity<LogPageResponse> getLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String level) {
        return ResponseEntity.ok(logService.getLogs(page, Math.min(size, MAX_PAGE_SIZE), search, level));
    }
}
