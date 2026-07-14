package com.pronocore.dto.request;

import com.pronocore.entity.Newsletter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class NewsletterRequest {

    @NotBlank(message = "Le titre est requis")
    @Size(max = 200)
    private String title;

    @Size(max = 200)
    private String subtitle;

    @NotBlank(message = "Le contenu est requis")
    private String bodyMd;

    private Newsletter.Theme theme = Newsletter.Theme.FOOTBALL;

    @Size(max = 100)
    private String ctaLabel;

    @Size(max = 500)
    private String ctaUrl;
}
