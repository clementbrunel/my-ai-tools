package com.mymoneyhub.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * @param binaryPath path to the {@code woob} executable (on PATH by default)
 * @param timeout    max wall-clock time for one woob call — a BNP login + history scrape usually takes
 *                   10–30s; the bound is there so a stuck call (e.g. a 2FA prompt) can't hang a sync
 */
@ConfigurationProperties(prefix = "mymoneyhub.woob")
public record WoobProperties(String binaryPath, Duration timeout) {

    public WoobProperties {
        if (binaryPath == null || binaryPath.isBlank()) {
            binaryPath = "woob";
        }
        if (timeout == null) {
            timeout = Duration.ofMinutes(2);
        }
    }
}
