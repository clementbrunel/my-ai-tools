package com.mymoneyhub.controller;

import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.InstitutionRepository;
import com.mymoneyhub.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;
    private final InstitutionRepository institutionRepository;

    @PostMapping("/api/sync")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void syncAll() {
        syncService.syncAll();
    }

    @PostMapping("/api/institutions/{id}/sync")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void syncOne(@PathVariable Long id) {
        Institution institution = institutionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Institution not found"));
        syncService.syncInstitution(institution);
    }
}
