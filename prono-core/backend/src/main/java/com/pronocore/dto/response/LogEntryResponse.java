package com.pronocore.dto.response;

import com.pronocore.logging.InMemoryLogAppender;

import java.time.Instant;

public record LogEntryResponse(Instant timestamp, String level, String logger, String thread, String message) {

    public static LogEntryResponse from(InMemoryLogAppender.LogEntry entry) {
        return new LogEntryResponse(entry.timestamp(), entry.level(), entry.logger(), entry.thread(), entry.message());
    }
}
