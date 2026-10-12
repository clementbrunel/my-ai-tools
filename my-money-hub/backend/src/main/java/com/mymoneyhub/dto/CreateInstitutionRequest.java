package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Institution;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CreateInstitutionRequest(
        @NotBlank String name,
        @NotNull Institution.InstitutionType type,
        @NotNull Institution.ConnectorType connectorType,
        String externalRef,
        @Pattern(regexp = "[A-Z]{2}") String externalCountry
) {
}
