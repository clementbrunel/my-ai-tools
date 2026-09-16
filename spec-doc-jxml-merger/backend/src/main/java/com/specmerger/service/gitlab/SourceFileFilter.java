package com.specmerger.service.gitlab;

import java.util.Arrays;
import java.util.List;
import org.springframework.util.AntPathMatcher;
import org.springframework.util.StringUtils;

/**
 * Decides which files of a JWAY GitLab project are worth sending to the model: the
 * JXML sources themselves, their translation resources (to resolve {@code trans(...)}
 * keys), and — only when explicitly configured — Java classes for outbound business
 * calls. Everything else in the repo (build files, tests, generated assets, ...) is
 * dropped before download. Translation/Java patterns are per GitLab group (see
 * {@link com.specmerger.config.GitLabProperties.Group}), since different groups use
 * different conventions (e.g. fixed-name .properties files vs. .xlf).
 */
public class SourceFileFilter {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    private final List<String> translationPatterns;
    private final List<String> javaPatterns;

    public SourceFileFilter(String translationPatternsCsv, String javaPatternsCsv) {
        this.translationPatterns = splitPatterns(translationPatternsCsv);
        this.javaPatterns = splitPatterns(javaPatternsCsv);
    }

    public boolean isRelevant(String path) {
        return isJxml(path) || matchesAny(path, translationPatterns) || matchesAny(path, javaPatterns);
    }

    private boolean isJxml(String path) {
        return path.toLowerCase().endsWith(".jxml");
    }

    private boolean matchesAny(String path, List<String> patterns) {
        return patterns.stream().anyMatch(pattern -> MATCHER.match(pattern, path));
    }

    private static List<String> splitPatterns(String csv) {
        if (!StringUtils.hasText(csv)) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }
}
