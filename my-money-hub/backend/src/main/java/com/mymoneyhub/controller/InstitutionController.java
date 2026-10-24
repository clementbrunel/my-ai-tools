package com.mymoneyhub.controller;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.CreateInstitutionRequest;
import com.mymoneyhub.dto.CreateManualAccountRequest;
import com.mymoneyhub.dto.InstitutionDto;
import com.mymoneyhub.service.AccountService;
import com.mymoneyhub.service.InstitutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institutions")
@RequiredArgsConstructor
public class InstitutionController {

    private final InstitutionService institutionService;
    private final AccountService accountService;

    @GetMapping
    public List<InstitutionDto> listAll() {
        return institutionService.listAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionDto create(@Valid @RequestBody CreateInstitutionRequest request) {
        return institutionService.create(request);
    }

    @PostMapping("/{id}/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountDto createManualAccount(@PathVariable Long id, @Valid @RequestBody CreateManualAccountRequest request) {
        return accountService.createManualAccount(id, request);
    }
}
