package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Institution;

public record InstitutionDto(
        Long id,
        String name,
        Institution.InstitutionType type,
        Institution.ConnectorType connectorType,
        String externalRef
) {
}
