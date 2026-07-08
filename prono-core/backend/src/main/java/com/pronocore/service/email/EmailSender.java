package com.pronocore.service.email;

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
@Component
public class EmailSender {

    private static final String FROM_ADDRESS = "PronoCore <noreply@app.prono-core.top>";

    private final RestClient restClient;

    @Value("${resend.api-key}")
    private String apiKey;

    public EmailSender() {
        this.restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .build();
    }

    public void send(String to, String subject, String html) {
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
