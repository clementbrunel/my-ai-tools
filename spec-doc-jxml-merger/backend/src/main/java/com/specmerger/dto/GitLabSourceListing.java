package com.specmerger.dto;

import java.util.List;

/**
 * Result of browsing a project's relevant files: {@code entryPoints} are the candidate
 * démarches found in FORMS.jxml (one EAR can serve several — the user picks exactly one),
 * and {@code optionalPaths} are the remaining relevant files (includes, translations, Java)
 * the user can freely check/uncheck. Entry-point files are never part of optionalPaths.
 */
public record GitLabSourceListing(List<GitLabEntryPoint> entryPoints, List<String> optionalPaths) {
}
