package com.specmerger.dto;

import java.util.List;
import java.util.UUID;

public record AnalysisSessionResponse(
        UUID id,
        String title,
        String status,
        String markdown,
        List<DivergenceDto> divergences) {
}
