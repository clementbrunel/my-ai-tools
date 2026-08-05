package com.pronocore.service.f1;

import com.pronocore.client.ExternalApiRegistry;
import com.pronocore.entity.ExternalApi;
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

    private final ExternalApiRegistry registry;
    private final String configuredBaseUrl;

    /** Built on first use: the registry is seeded by Flyway and cannot be read at construction. */
    private volatile RestClient restClient;

    public HttpJolpicaClient(ExternalApiRegistry registry,
                             @Value("${f1.jolpica.base-url}") String configuredBaseUrl) {
        this.registry          = registry;
        this.configuredBaseUrl = configuredBaseUrl;
    }

    private RestClient restClient() {
        RestClient local = restClient;
        if (local != null) return local;
        synchronized (this) {
            if (restClient == null) {
                String baseUrl = registry.baseUrlOr(ExternalApi.JOLPICA_CODE, configuredBaseUrl);
                log.info("jolpica base URL resolved to {}", baseUrl);
                SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
                requestFactory.setConnectTimeout(Duration.ofSeconds(10));
                requestFactory.setReadTimeout(Duration.ofSeconds(20));
                restClient = RestClient.builder()
                        .baseUrl(baseUrl)
                        .requestFactory(requestFactory)
                        // Some CDNs reject the default Java agent; jolpica also expects JSON.
                        .defaultHeader("User-Agent", "prono-core/1.0 (F1 pronostics; +https://github.com/clementbrunel/my-ai-tools)")
                        .defaultHeader("Accept", "application/json")
                        .build();
            }
            return restClient;
        }
    }

    /** GETs the path, retrying twice on 429/5xx (jolpica rate-limits unauthenticated bursts). */
    @Override
    public String get(String path) {
        // Spring's DefaultUriBuilderFactory concatenates baseUrl + uri literally:
        // without the leading slash, "2026.json" would become ".../f12026.json" → 404.
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
