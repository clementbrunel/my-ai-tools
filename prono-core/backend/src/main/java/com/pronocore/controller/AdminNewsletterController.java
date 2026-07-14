package com.pronocore.controller;

import com.pronocore.dto.request.NewsletterRequest;
import com.pronocore.dto.request.NewsletterTestRequest;
import com.pronocore.dto.response.NewsletterResponse;
import com.pronocore.service.NewsletterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/newsletter")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@Tag(name = "Admin – Newsletter", description = "Broadcast campaigns for big feature announcements")
public class AdminNewsletterController {

    private final NewsletterService newsletterService;

    @GetMapping
    @Operation(summary = "List all newsletter campaigns")
    public List<NewsletterResponse> list() {
        return newsletterService.listAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single campaign")
    public NewsletterResponse get(@PathVariable Long id) {
        return newsletterService.get(id);
    }

    @PostMapping
    @Operation(summary = "Create a draft campaign")
    public NewsletterResponse create(@Valid @RequestBody NewsletterRequest request, Authentication auth) {
        return newsletterService.create(request, auth.getName());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a draft campaign (drafts only)")
    public NewsletterResponse update(@PathVariable Long id, @Valid @RequestBody NewsletterRequest request) {
        return newsletterService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a draft campaign (drafts only)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        newsletterService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/{id}/preview", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Rendered HTML preview of the campaign")
    public String preview(@PathVariable Long id) {
        return newsletterService.renderHtml(id);
    }

    @PostMapping("/{id}/test")
    @Operation(summary = "Send the campaign to a single test address")
    public ResponseEntity<Void> test(@PathVariable Long id, @Valid @RequestBody NewsletterTestRequest request) {
        newsletterService.sendTest(id, request.getTargetEmail());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/send")
    @Operation(summary = "Broadcast the campaign to all opted-in users (one-shot, irreversible)")
    public ResponseEntity<Map<String, Object>> send(@PathVariable Long id) {
        int count = newsletterService.broadcast(id);
        return ResponseEntity.ok(Map.of("recipientCount", count));
    }
}
