package com.pronocore.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.config.FootballDataProperties;
import com.pronocore.entity.ExternalApi;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

@Slf4j
@Component
public class HttpFootballDataClient implements FootballDataHttpClient {

    private final ExternalApiRegistry     registry;
    private final FootballDataProperties  props;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Built on first use: the registry is seeded by Flyway and cannot be read at construction. */
    private volatile RestClient restClient;

    public HttpFootballDataClient(ExternalApiRegistry registry, FootballDataProperties props) {
        this.registry = registry;
        this.props    = props;
    }

    private RestClient restClient() {
        RestClient local = restClient;
        if (local != null) return local;
        synchronized (this) {
            if (restClient == null) {
                String baseUrl = registry.baseUrlOr(ExternalApi.FOOTBALL_DATA_CODE, props.getBaseUrl());
                log.info("football-data.org base URL resolved to {}", baseUrl);
                SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                factory.setConnectTimeout(Duration.ofSeconds(10));
                factory.setReadTimeout(Duration.ofSeconds(20));
                restClient = RestClient.builder()
                        .baseUrl(baseUrl)
                        .requestFactory(factory)
                        .defaultHeader("X-Auth-Token", props.getApiKey())
                        .defaultHeader("Accept", "application/json")
                        .build();
            }
            return restClient;
        }
    }

    /**
     * GETs the path, retrying twice on 429/5xx. The free tier's rate limit (10 requests/minute)
     * is much tighter than api-football's, so a burst (e.g. the season-wide fixture import)
     * is expected to hit 429 occasionally — the backoff here is longer accordingly.
     */
    @Override
    public String get(String path) {
        String uri = path.startsWith("/") ? path : "/" + path;
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient().get().uri(uri).retrieve().body(String.class);
            } catch (RestClientResponseException e) {
                boolean retryable = e.getStatusCode().value() == 429 || e.getStatusCode().is5xxServerError();
                if (!retryable || attempts >= 3) {
                    throw new IllegalStateException(
                            "football-data.org HTTP " + e.getStatusCode().value() + " on " + path
                                    + ": " + extractMessage(e), e);
                }
                log.warn("football-data.org {} on {} — retry {}/2", e.getStatusCode().value(), path, attempts);
                sleep(6_000L * attempts);
            }
        }
    }

    /** football-data.org error bodies look like {"message": "..."}. Falls back to the raw body. */
    private String extractMessage(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        if (body == null || body.isBlank()) return e.getMessage();
        try {
            JsonNode message = objectMapper.readTree(body).path("message");
            return message.isMissingNode() ? body : message.asText(body);
        } catch (Exception parseFailure) {
            return body;
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("football-data.org retry interrupted", ie);
        }
    }
}
