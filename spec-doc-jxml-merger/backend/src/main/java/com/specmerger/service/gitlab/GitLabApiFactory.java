package com.specmerger.service.gitlab;

import org.gitlab4j.api.GitLabApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Builds a {@link GitLabApi} client on demand rather than as a Spring bean, so a
 * missing GITLAB_URL/GITLAB_TOKEN only breaks GitLab-backed features (checked at
 * call time) instead of failing application startup.
 */
@Component
public class GitLabApiFactory {

    private final String url;
    private final String token;

    public GitLabApiFactory(@Value("${gitlab.url:}") String url, @Value("${gitlab.token:}") String token) {
        this.url = url;
        this.token = token;
    }

    public boolean isConfigured() {
        return !url.isBlank() && !token.isBlank();
    }

    public GitLabApi create() {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "GitLab non configuré : renseigner GITLAB_URL et GITLAB_TOKEN.");
        }
        return new GitLabApi(url, token);
    }
}
