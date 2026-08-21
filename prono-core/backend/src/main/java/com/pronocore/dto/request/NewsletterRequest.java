package com.pronocore.dto.request;

import com.pronocore.entity.Newsletter;
import com.pronocore.entity.Sport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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

    /** Null = broadcast to every opted-in user; otherwise restricted to members of groups playing this sport. */
    private Sport targetSport;

    @Size(max = 100)
    private String ctaLabel;

    @Size(max = 500)
    @Pattern(regexp = "^$|^https?://.+", message = "L'URL du CTA doit commencer par http:// ou https://")
    private String ctaUrl;
}
