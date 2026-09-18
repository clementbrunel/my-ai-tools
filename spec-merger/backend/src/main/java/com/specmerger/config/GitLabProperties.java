package com.specmerger.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * GitLab access (#266). Projects to translate live in several GitLab groups, each
 * with its own convention for translation resources (e.g. fixed-name .properties
 * files in one group, .xlf files in another) — see {@code gitlab.groups} in
 * application.yml.
 *
 * @param translationLanguage language used to resolve {@code trans(...)} keys found in JXML
 *                            content against the selected {@code .properties}/{@code .xlf}
 *                            resources (see {@link com.specmerger.service.gitlab.TranslationResolver}
 *                            and issue #285) — an ISO-639-1 code matching either a translation
 *                            file's fixed name (e.g. {@code fr.properties}) or an XLIFF file's
 *                            {@code source-language}/{@code target-language} attribute.
 */
@ConfigurationProperties(prefix = "gitlab")
public record GitLabProperties(String url, String token, List<Group> groups, String translationLanguage) {

    public GitLabProperties {
        groups = groups == null ? List.of() : groups;
        translationLanguage = (translationLanguage == null || translationLanguage.isBlank()) ? "fr" : translationLanguage;
    }

    /**
     * @param key                 stable identifier used to pick this group's filter back up when
     *                            downloading a project's sources (e.g. "properties", "xlf")
     * @param path                full path of the GitLab group/subgroup ("group/subgroup") or its
     *                            numeric ID
     * @param translationPatterns comma-separated Ant patterns of translation resources to include
     * @param javaPatterns        comma-separated Ant patterns of outbound business-call Java classes
     *                            to include (empty: none are sent)
     */
    public record Group(String key, String path, String translationPatterns, String javaPatterns) {
    }
}
