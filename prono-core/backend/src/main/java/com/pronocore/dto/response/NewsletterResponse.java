package com.pronocore.dto.response;

import com.pronocore.entity.Newsletter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewsletterResponse {

    private Long id;
    private String title;
    private String subtitle;
    private String bodyMd;
    private Newsletter.Theme theme;
    private String ctaLabel;
    private String ctaUrl;
    private Newsletter.Status status;
    private int sentCount;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime sentAt;

    public static NewsletterResponse from(Newsletter n) {
        return NewsletterResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .subtitle(n.getSubtitle())
                .bodyMd(n.getBodyMd())
                .theme(n.getTheme())
                .ctaLabel(n.getCtaLabel())
                .ctaUrl(n.getCtaUrl())
                .status(n.getStatus())
                .sentCount(n.getSentCount())
                .createdBy(n.getCreatedBy())
                .createdAt(n.getCreatedAt())
                .sentAt(n.getSentAt())
                .build();
    }
}
