package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Institution;

import java.time.LocalDateTime;

public record InstitutionDto(
        Long id,
        String name,
        Institution.InstitutionType type,
        Institution.ConnectorType connectorType,
        String externalRef,
        String externalCountry,
        LocalDateTime sessionValidUntil
) {
}
