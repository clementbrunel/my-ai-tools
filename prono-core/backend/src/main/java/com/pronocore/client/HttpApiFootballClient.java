package com.pronocore.client;

import com.pronocore.config.ApiFootballProperties;
import com.pronocore.entity.ExternalApi;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

@Slf4j
@Component
public class HttpApiFootballClient implements ApiFootballHttpClient {

    private final ExternalApiRegistry   registry;
    private final ApiFootballProperties props;

    /** Built on first use: the registry is seeded by Flyway and cannot be read at construction. */
    private volatile RestClient restClient;

    public HttpApiFootballClient(ExternalApiRegistry registry, ApiFootballProperties props) {
        this.registry = registry;
        this.props    = props;
    }

    private RestClient restClient() {
        RestClient local = restClient;
        if (local != null) return local;
        synchronized (this) {
            if (restClient == null) {
                String baseUrl = registry.baseUrlOr(ExternalApi.API_FOOTBALL_CODE, props.getBaseUrl());
                log.info("api-football base URL resolved to {}", baseUrl);
                SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                factory.setConnectTimeout(Duration.ofSeconds(10));
                factory.setReadTimeout(Duration.ofSeconds(20));
                restClient = RestClient.builder()
                        .baseUrl(baseUrl)
                        .requestFactory(factory)
                        .defaultHeader("x-apisports-key", props.getApiKey())
                        .defaultHeader("Accept", "application/json")
                        .build();
            }
            return restClient;
        }
    }

    /** GETs the path, retrying twice on 429/5xx (api-football throttles bursts and daily quota). */
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
                            "api-football HTTP " + e.getStatusCode().value() + " on " + path, e);
                }
                log.warn("api-football {} on {} — retry {}/2", e.getStatusCode().value(), path, attempts);
                sleep(1500L * attempts);
            }
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("api-football retry interrupted", ie);
        }
    }
}
