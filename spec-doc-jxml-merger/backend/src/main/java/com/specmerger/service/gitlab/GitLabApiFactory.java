package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import org.springframework.stereotype.Component;

/**
 * Builds a {@link GitLabApi} client on demand rather than as a Spring bean, so a
 * missing GITLAB_URL/GITLAB_TOKEN only breaks GitLab-backed features (checked at
 * call time) instead of failing application startup.
 */
@Slf4j
@Component
public class GitLabApiFactory {

    /**
     * gitlab4j-api appends "/api/v4" itself (see GitLabApiClient) — if GITLAB_URL
     * already ends with it (a common copy-paste mistake from GitLab API docs/Postman),
     * every request 404s on a duplicated path (".../api/v4/api/v4/..."). Strip it
     * defensively rather than fail confusingly.
     */
    private static final Pattern TRAILING_API_SUFFIX = Pattern.compile("(?i)/api/v\\d+/?$");

    private final GitLabProperties properties;

    public GitLabApiFactory(GitLabProperties properties) {
        this.properties = properties;
    }

    public boolean isConfigured() {
        return properties.url() != null && !properties.url().isBlank()
                && properties.token() != null && !properties.token().isBlank();
    }

    public GitLabApi create() {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "GitLab non configuré : renseigner GITLAB_URL et GITLAB_TOKEN.");
        }
        return new GitLabApi(resolvedUrl(), properties.token());
    }

    private String resolvedUrl() {
        String url = properties.url().trim();
        Matcher matcher = TRAILING_API_SUFFIX.matcher(url);
        if (matcher.find()) {
            String stripped = url.substring(0, matcher.start());
            log.warn("GITLAB_URL='{}' contient déjà un suffixe d'API ('{}') : utilisation de '{}' à la place "
                            + "pour éviter un chemin dupliqué (ex. /api/v4/api/v4/...) qui provoque des 404.",
                    url, url.substring(matcher.start()), stripped);
            return stripped;
        }
        return url;
    }
}
