package com.mymoneyhub.controller;

import com.mymoneyhub.config.EnableBankingProperties;
import com.mymoneyhub.connector.EnableBankingException;
import com.mymoneyhub.dto.ConnectResponse;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.InstitutionRepository;
import com.mymoneyhub.service.EnableBankingConsentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@Slf4j
public class EnableBankingController {

    private final EnableBankingConsentService consentService;
    private final InstitutionRepository institutionRepository;
    private final EnableBankingProperties properties;

    /** Returns the bank's consent page — the frontend sends the browser there. */
    @PostMapping("/api/institutions/{id}/connect")
    public ConnectResponse connect(@PathVariable Long id) {
        Institution institution = institutionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Institution not found"));
        return new ConnectResponse(consentService.start(institution));
    }

    /** Target of {@code mymoneyhub.enable-banking.redirect-url}: the bank sends the user back here. */
    @GetMapping("/api/enable-banking/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error,
                                         @RequestParam(name = "error_description", required = false) String errorDescription) {
        UriComponentsBuilder target = UriComponentsBuilder.fromUriString(properties.frontendUrl());
        if (error != null || code == null) {
            log.warn("Enable Banking consent refused or failed: {} {}", error, errorDescription);
            target.queryParam("connectError", errorDescription != null ? errorDescription : error);
        } else {
            try {
                Institution institution = consentService.complete(state, code);
                target.queryParam("connected", institution.getName());
            } catch (EnableBankingException e) {
                log.warn("Enable Banking session creation failed", e);
                target.queryParam("connectError", e.getMessage());
            }
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(target.encode().toUriString())).build();
    }

    @ExceptionHandler(EnableBankingException.class)
    ResponseEntity<String> handle(EnableBankingException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(e.getMessage());
    }
}
