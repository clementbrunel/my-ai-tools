package com.pronocore.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NewsletterTestRequest {

    @NotBlank(message = "L'adresse email cible est requise")
    @Email(message = "Format d'email invalide")
    private String targetEmail;
}
