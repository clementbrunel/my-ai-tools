package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import com.specmerger.dto.GitLabProjectSummary;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import org.gitlab4j.api.GitLabApiException;
import org.gitlab4j.api.models.Project;
import org.gitlab4j.api.models.TreeItem;
import org.springframework.stereotype.Service;

/**
 * Browses the configured GitLab groups of JWAY projects (see #266) and downloads
 * only the files worth sending to the model, replacing the manual zip/paste upload
 * flow. Each group has its own translation/Java filter patterns (see
 * {@link GitLabProperties.Group}).
 */
@Slf4j
@Service
public class GitLabSourceService {

    private final GitLabApiFactory apiFactory;
    private final GitLabProperties properties;

    public GitLabSourceService(GitLabApiFactory apiFactory, GitLabProperties properties) {
        this.apiFactory = apiFactory;
        this.properties = properties;
    }

    @PostConstruct
    void logConfiguration() {
        log.info("GitLab config : url='{}', token={}", properties.url(), maskedToken());
        if (properties.groups().isEmpty()) {
            log.warn("GitLab config : gitlab.groups est vide, aucun groupe GitLab ne sera interrogé.");
            return;
        }
        for (GitLabProperties.Group group : properties.groups()) {
            boolean enabled = group.path() != null && !group.path().isBlank();
            log.info("GitLab config : groupe key='{}' path='{}' ({}), translationPatterns='{}', javaPatterns='{}'",
                    group.key(), group.path(), enabled ? "activé" : "désactivé, path vide",
                    group.translationPatterns(), group.javaPatterns());
        }
    }

    /** Lists the projects of every configured group, tagged with the group's key. */
    public List<GitLabProjectSummary> listAllProjects() throws GitLabApiException {
        try (GitLabApi api = apiFactory.create()) {
            List<GitLabProjectSummary> summaries = new ArrayList<>();
            for (GitLabProperties.Group group : properties.groups()) {
                if (group.path() == null || group.path().isBlank()) {
                    continue;
                }
                Object identifier = resolveIdentifier(group.path());
                log.debug("GitLab: listing des projets du groupe '{}' (identifiant résolu='{}')",
                        group.key(), identifier);
                List<Project> projects;
                try {
                    projects = api.getGroupApi().getProjects(identifier);
                } catch (GitLabApiException e) {
                    log.error("GitLab: échec du listing des projets pour le groupe '{}' (GITLAB_GROUP path='{}', "
                                    + "identifiant résolu='{}') : HTTP {} {} — {}",
                            group.key(), group.path(), identifier, e.getHttpStatus(), e.getReason(), e.getMessage());
                    throw e;
                }
                log.info("GitLab: {} projet(s) trouvé(s) pour le groupe '{}'", projects.size(), group.key());
                for (Project p : projects) {
                    summaries.add(new GitLabProjectSummary(
                            p.getId(), p.getName(), p.getPathWithNamespace(), p.getDefaultBranch(), p.getWebUrl(),
                            group.key()));
                }
            }
            return summaries;
        }
    }

    /**
     * Downloads only the files of the project that the group's {@link SourceFileFilter}
     * deems relevant (JXML sources, translation resources, and — when configured —
     * outbound business-call Java classes), keyed by their repository path.
     */
    public Map<String, String> fetchRelevantSources(String groupKey, String projectIdOrPath)
            throws GitLabApiException, IOException {
        SourceFileFilter filter = filterFor(groupKey);
        try (GitLabApi api = apiFactory.create()) {
            Object projectId = resolveIdentifier(projectIdOrPath);
            log.debug("GitLab: résolution du projet '{}' (groupe='{}', identifiant résolu='{}')",
                    projectIdOrPath, groupKey, projectId);
            Project project;
            try {
                project = api.getProjectApi().getProject(projectId);
            } catch (GitLabApiException e) {
                log.error("GitLab: échec de la résolution du projet '{}' (groupe='{}', identifiant résolu='{}') : "
                                + "HTTP {} {} — {}",
                        projectIdOrPath, groupKey, projectId, e.getHttpStatus(), e.getReason(), e.getMessage());
                throw e;
            }
            String ref = project.getDefaultBranch();
            log.debug("GitLab: projet '{}' résolu (branche par défaut='{}')", project.getPathWithNamespace(), ref);

            List<TreeItem> tree;
            try {
                tree = api.getRepositoryApi().getTree(projectId, "", ref, true);
            } catch (GitLabApiException e) {
                log.error("GitLab: échec de la lecture de l'arborescence du projet '{}' (branche='{}') : "
                                + "HTTP {} {} — {}",
                        project.getPathWithNamespace(), ref, e.getHttpStatus(), e.getReason(), e.getMessage());
                throw e;
            }
            log.debug("GitLab: {} entrée(s) dans l'arborescence de '{}'", tree.size(), project.getPathWithNamespace());

            Map<String, String> filesByPath = new LinkedHashMap<>();
            for (TreeItem item : tree) {
                if (item.getType() != TreeItem.Type.BLOB || !filter.isRelevant(item.getPath())) {
                    continue;
                }
                try (InputStream raw = api.getRepositoryFileApi().getRawFile(projectId, ref, item.getPath())) {
                    filesByPath.put(item.getPath(), new String(raw.readAllBytes(), StandardCharsets.UTF_8));
                } catch (GitLabApiException e) {
                    log.error("GitLab: échec du téléchargement de '{}' dans '{}' (branche='{}') : HTTP {} {} — {}",
                            item.getPath(), project.getPathWithNamespace(), ref,
                            e.getHttpStatus(), e.getReason(), e.getMessage());
                    throw e;
                }
            }
            log.info("GitLab: {} fichier(s) retenu(s) sur {} ({}) après filtrage",
                    filesByPath.size(), project.getPathWithNamespace(), groupKey);
            return filesByPath;
        }
    }

    private SourceFileFilter filterFor(String groupKey) {
        GitLabProperties.Group group = properties.groups().stream()
                .filter(g -> g.key() != null && g.key().equals(groupKey))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Groupe GitLab inconnu : " + groupKey));
        return new SourceFileFilter(group.translationPatterns(), group.javaPatterns());
    }

    private Object resolveIdentifier(String idOrPath) {
        String trimmed = idOrPath.trim();
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException e) {
            return trimmed;
        }
    }

    private String maskedToken() {
        String token = properties.token();
        if (token == null || token.isBlank()) {
            return "(absent)";
        }
        int visible = Math.min(3, token.length());
        return "?".repeat(token.length() - visible) + token.substring(token.length() - visible);
    }
}
