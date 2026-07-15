package com.pronocore.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TestEmailRequest {

    @NotBlank(message = "L'adresse email cible est requise")
    @Email(message = "Format d'email invalide")
    private String targetEmail;

    @NotNull(message = "Le type de template est requis")
    private EmailType emailType;
}
