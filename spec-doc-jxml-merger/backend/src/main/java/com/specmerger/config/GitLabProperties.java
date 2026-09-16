package com.specmerger.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * GitLab access (#266). Projects to translate live in several GitLab groups, each
 * with its own convention for translation resources (e.g. fixed-name .properties
 * files in one group, .xlf files in another) — see {@code gitlab.groups} in
 * application.yml.
 */
@ConfigurationProperties(prefix = "gitlab")
public record GitLabProperties(String url, String token, List<Group> groups) {

    public GitLabProperties {
        groups = groups == null ? List.of() : groups;
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
