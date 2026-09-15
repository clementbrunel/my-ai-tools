package com.mymoneyhub.service;

import com.mymoneyhub.dto.CreateInstitutionRequest;
import com.mymoneyhub.dto.InstitutionDto;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.InstitutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InstitutionService {

    private final InstitutionRepository institutionRepository;

    public List<InstitutionDto> listAll() {
        return institutionRepository.findAll().stream().map(this::toDto).toList();
    }

    public InstitutionDto create(CreateInstitutionRequest request) {
        Institution institution = Institution.builder()
                .name(request.name())
                .type(request.type())
                .connectorType(request.connectorType())
                .externalRef(request.externalRef())
                .build();
        return toDto(institutionRepository.save(institution));
    }

    private InstitutionDto toDto(Institution institution) {
        return new InstitutionDto(
                institution.getId(),
                institution.getName(),
                institution.getType(),
                institution.getConnectorType(),
                institution.getExternalRef()
        );
    }
}
