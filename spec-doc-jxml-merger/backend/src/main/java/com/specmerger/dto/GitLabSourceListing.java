package com.specmerger.dto;

import java.util.List;

/**
 * Result of browsing a project's relevant files: {@code entryPoints} are the candidate
 * démarches found in FORMS.jxml (one EAR can serve several — the user picks exactly one),
 * {@code mandatoryPaths} are the translation resources ({@code .properties}/{@code .xlf}) —
 * always fetched to resolve {@code trans(...)} keys (see #285), never a free checkbox since
 * excluding them only degrades the generated doc — and {@code optionalPaths} are the
 * remaining relevant files (includes, Java) the user can freely check/uncheck. Entry-point
 * files are never part of either.
 */
public record GitLabSourceListing(List<GitLabEntryPoint> entryPoints, List<String> mandatoryPaths,
        List<String> optionalPaths) {
}
