package com.pronocore.client;

import com.pronocore.entity.ExternalApi;
import com.pronocore.repository.ExternalApiRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Resolves provider endpoints from the {@code external_apis} table, so the base
 * URL of a data source can be changed in database without redeploying.
 *
 * <p>Lookups are lazy — the registry is seeded by Flyway, so it must not be read
 * while beans are being constructed. Each caller memoises the value it resolves.
 * When a provider is missing from the registry or carries no base URL, the value
 * configured in {@code application.yml} is used instead, which keeps the clients
 * working on a database that predates the registry.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExternalApiRegistry {

    private final ExternalApiRepository repository;

    /** Base URL registered for {@code code}, or {@code fallback} when unavailable. */
    public String baseUrlOr(String code, String fallback) {
        try {
            return repository.findByCode(code)
                    .map(ExternalApi::getBaseUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .orElse(fallback);
        } catch (Exception e) {
            log.warn("external_apis lookup failed for {} — falling back to configuration: {}",
                    code, e.getMessage());
            return fallback;
        }
    }
}
