package com.pronocore.client;

import com.pronocore.config.ApiFootballProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

@Slf4j
@Component
public class HttpApiFootballClient implements ApiFootballHttpClient {

    private final RestClient restClient;

    public HttpApiFootballClient(ApiFootballProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("x-apisports-key", props.getApiKey())
                .defaultHeader("Accept", "application/json")
                .build();
    }

    /** GETs the path, retrying twice on 429/5xx (api-football throttles bursts and daily quota). */
    @Override
    public String get(String path) {
        String uri = path.startsWith("/") ? path : "/" + path;
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get().uri(uri).retrieve().body(String.class);
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
