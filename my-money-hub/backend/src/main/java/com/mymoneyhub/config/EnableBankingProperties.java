package com.mymoneyhub.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param redirectUrl         where the bank sends the user back after consent — must be whitelisted on the
 *                            Enable Banking application and reach {@code GET /api/enable-banking/callback}
 * @param frontendUrl         where the callback finally redirects the browser once the session is stored
 * @param consentValidityDays requested consent duration, capped by the ASPSP's own maximum
 */
@ConfigurationProperties(prefix = "mymoneyhub.enable-banking")
public record EnableBankingProperties(
        String baseUrl,
        String applicationId,
        String privateKeyPath,
        String redirectUrl,
        String frontendUrl,
        Integer consentValidityDays
) {
}
