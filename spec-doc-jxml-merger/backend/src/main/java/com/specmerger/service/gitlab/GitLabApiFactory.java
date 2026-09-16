package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import org.gitlab4j.api.GitLabApi;
import org.springframework.stereotype.Component;

/**
 * Builds a {@link GitLabApi} client on demand rather than as a Spring bean, so a
 * missing GITLAB_URL/GITLAB_TOKEN only breaks GitLab-backed features (checked at
 * call time) instead of failing application startup.
 */
@Component
public class GitLabApiFactory {

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
        return new GitLabApi(properties.url(), properties.token());
    }
}
