package com.specmerger.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * OIDC protection of the API — see {@code app.security} in application.yml. The API is a pure
 * resource server: it never logs anyone in, it only validates the bearer JWT forwarded by
 * oauth2-proxy (issued by the OIDC provider, Keycloak).
 *
 * @param enabled   false leaves the API open (local dev / mock mode)
 * @param issuerUri realm URL of the provider, required when {@code enabled}
 * @param audience  if not blank, the token's {@code aud} claim must contain it
 */
@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(boolean enabled, String issuerUri, String audience) {

    public SecurityProperties {
        issuerUri = issuerUri == null ? "" : issuerUri.trim();
        audience = audience == null ? "" : audience.trim();
        if (enabled && issuerUri.isEmpty()) {
            throw new IllegalStateException("OIDC_ENABLED=true requires OIDC_ISSUER_URI");
        }
    }
}
