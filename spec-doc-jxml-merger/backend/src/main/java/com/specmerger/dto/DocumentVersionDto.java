package com.specmerger.dto;

import java.time.Instant;
import java.util.UUID;

public record DocumentVersionDto(
        UUID id,
        int versionNumber,
        String source,
        Instant createdAt) {
}
