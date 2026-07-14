package com.pronocore.service.f1;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

@Slf4j
@Component
public class HttpJolpicaClient implements JolpicaClient {

    private final RestClient restClient;

    public HttpJolpicaClient(@Value("${f1.jolpica.base-url:https://api.jolpi.ca/ergast/f1}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                // Some CDNs reject the default Java agent; jolpica also expects JSON.
                .defaultHeader("User-Agent", "prono-core/1.0 (F1 pronostics; +https://github.com/clementbrunel/my-ai-tools)")
                .defaultHeader("Accept", "application/json")
                .build();
    }

    /** GETs the path, retrying twice on 429/5xx (jolpica rate-limits unauthenticated bursts). */
    @Override
    public String get(String path) {
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get().uri(path).retrieve().body(String.class);
            } catch (RestClientResponseException e) {
                boolean retryable = e.getStatusCode().value() == 429 || e.getStatusCode().is5xxServerError();
                if (!retryable || attempts >= 3) {
                    throw new IllegalStateException(
                            "HTTP " + e.getStatusCode().value() + " sur " + path, e);
                }
                log.warn("jolpica {} on {} — retry {}/2", e.getStatusCode().value(), path, attempts);
                sleep(1500L * attempts);
            }
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("jolpica retry interrupted", ie);
        }
    }
}
