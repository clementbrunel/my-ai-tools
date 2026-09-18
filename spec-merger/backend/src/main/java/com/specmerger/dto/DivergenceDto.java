package com.specmerger.dto;

import java.util.UUID;

public record DivergenceDto(
        UUID id,
        String sectionRef,
        String wordExcerpt,
        String jxmlExcerpt,
        String aiProposal,
        String resolutionStatus,
        String resolvedValue) {
}
