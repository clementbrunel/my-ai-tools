package com.pronocore.dto.response;

import java.util.List;

public record LogPageResponse(List<LogEntryResponse> content, int page, int size, long totalElements) {
}
