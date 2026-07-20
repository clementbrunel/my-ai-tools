package com.pronocore.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Keeps a bounded in-memory ring buffer of recent log events so the admin "server logs"
 * tab has something to read without needing a log file or an external aggregator.
 * Buffer is per-instance and reset on restart — this is a live/recent-activity view,
 * not a durable log store.
 */
public class InMemoryLogAppender extends AppenderBase<ILoggingEvent> {

    public record LogEntry(Instant timestamp, String level, String logger, String thread, String message) {
    }

    private static final int CAPACITY = 5000;
    private static final Deque<LogEntry> BUFFER = new ArrayDeque<>(CAPACITY);

    @Override
    protected void append(ILoggingEvent event) {
        LogEntry entry = new LogEntry(
                Instant.ofEpochMilli(event.getTimeStamp()),
                event.getLevel().toString(),
                event.getLoggerName(),
                event.getThreadName(),
                event.getFormattedMessage()
        );
        synchronized (BUFFER) {
            if (BUFFER.size() >= CAPACITY) {
                BUFFER.removeFirst();
            }
            BUFFER.addLast(entry);
        }
    }

    public static List<LogEntry> snapshot() {
        synchronized (BUFFER) {
            return new ArrayList<>(BUFFER);
        }
    }
}
