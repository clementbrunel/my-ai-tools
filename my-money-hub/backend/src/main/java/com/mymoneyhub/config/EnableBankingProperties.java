package com.mymoneyhub.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mymoneyhub.enable-banking")
public record EnableBankingProperties(
        String baseUrl,
        String applicationId,
        String privateKeyPath,
        String redirectUrl
) {
}
