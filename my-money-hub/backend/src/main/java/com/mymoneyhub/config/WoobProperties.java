package com.mymoneyhub.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mymoneyhub.woob")
public record WoobProperties(String binaryPath) {
}
