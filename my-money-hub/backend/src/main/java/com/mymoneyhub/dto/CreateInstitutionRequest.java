package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Institution;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateInstitutionRequest(
        @NotBlank String name,
        @NotNull Institution.InstitutionType type,
        @NotNull Institution.ConnectorType connectorType,
        String externalRef
) {
}
