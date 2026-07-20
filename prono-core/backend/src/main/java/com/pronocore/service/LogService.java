package com.pronocore.service;

import com.pronocore.dto.response.LogEntryResponse;
import com.pronocore.dto.response.LogPageResponse;
import com.pronocore.logging.InMemoryLogAppender;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class LogService {

    public LogPageResponse getLogs(int page, int size, String search, String level) {
        List<InMemoryLogAppender.LogEntry> filtered = InMemoryLogAppender.snapshot().stream()
                .filter(e -> level == null || level.isBlank() || e.level().equalsIgnoreCase(level))
                .filter(e -> search == null || search.isBlank()
                        || e.message().toLowerCase().contains(search.toLowerCase())
                        || e.logger().toLowerCase().contains(search.toLowerCase()))
                .sorted(Comparator.comparing(InMemoryLogAppender.LogEntry::timestamp).reversed())
                .toList();

        int total = filtered.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);

        List<LogEntryResponse> content = filtered.subList(from, to).stream()
                .map(LogEntryResponse::from)
                .toList();

        return new LogPageResponse(content, page, size, total);
    }
}
