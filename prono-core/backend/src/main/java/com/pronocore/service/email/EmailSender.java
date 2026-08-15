package com.pronocore.service.email;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around the Resend HTTP API. Callers own retry/error policy;
 * this class only knows how to send one email.
 */
@Slf4j
@Component
public class EmailSender {

    private static final String FROM_ADDRESS = "PronoCore <noreply@app.prono-core.top>";

    /** Placeholder left in .env.example — never a real key. */
    private static final String PLACEHOLDER_KEY = "re_your_api_key_here";

    private final RestClient restClient;

    @Value("${resend.api-key}")
    private String apiKey;

    public EmailSender() {
        this.restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .build();
    }

    @PostConstruct
    void warnIfDisabled() {
        if (isDisabled()) {
            log.warn("resend: no RESEND_API_KEY set — email sending is disabled");
        }
    }

    public boolean isDisabled() {
        return apiKey == null || apiKey.isBlank() || apiKey.equals(PLACEHOLDER_KEY);
    }

    public void send(String to, String subject, String html) {
        if (isDisabled()) {
            log.warn("resend: skipping email to {} — no API key configured", to);
            return;
        }
        restClient.post()
            .uri("/emails")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of(
                "from", FROM_ADDRESS,
                "to", List.of(to),
                "subject", subject,
                "html", html
            ))
            .retrieve()
            .toBodilessEntity();
    }
}
