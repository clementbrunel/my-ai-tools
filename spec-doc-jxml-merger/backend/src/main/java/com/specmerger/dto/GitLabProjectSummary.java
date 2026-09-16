package com.specmerger.dto;

public record GitLabProjectSummary(
        Long id,
        String name,
        String pathWithNamespace,
        String defaultBranch,
        String webUrl) {
}
