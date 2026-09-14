package com.mymoneyhub.controller;

import com.mymoneyhub.dto.CreateInstitutionRequest;
import com.mymoneyhub.dto.InstitutionDto;
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

    @GetMapping
    public List<InstitutionDto> listAll() {
        return institutionService.listAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionDto create(@Valid @RequestBody CreateInstitutionRequest request) {
        return institutionService.create(request);
    }
}
