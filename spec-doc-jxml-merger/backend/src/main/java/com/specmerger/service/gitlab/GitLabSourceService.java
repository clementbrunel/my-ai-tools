package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import com.specmerger.dto.GitLabProjectSummary;
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

    /** Lists the projects of every configured group, tagged with the group's key. */
    public List<GitLabProjectSummary> listAllProjects() throws GitLabApiException {
        try (GitLabApi api = apiFactory.create()) {
            List<GitLabProjectSummary> summaries = new ArrayList<>();
            for (GitLabProperties.Group group : properties.groups()) {
                if (group.path() == null || group.path().isBlank()) {
                    continue;
                }
                List<Project> projects = api.getGroupApi().getProjects(resolveIdentifier(group.path()));
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
            Project project = api.getProjectApi().getProject(projectId);
            String ref = project.getDefaultBranch();

            List<TreeItem> tree = api.getRepositoryApi().getTree(projectId, "", ref, true);
            Map<String, String> filesByPath = new LinkedHashMap<>();
            for (TreeItem item : tree) {
                if (item.getType() != TreeItem.Type.BLOB || !filter.isRelevant(item.getPath())) {
                    continue;
                }
                try (InputStream raw = api.getRepositoryFileApi().getRawFile(projectId, ref, item.getPath())) {
                    filesByPath.put(item.getPath(), new String(raw.readAllBytes(), StandardCharsets.UTF_8));
                }
            }
            log.info("GitLab: {} fichier(s) retenu(s) sur {} ({}) après filtrage",
                    filesByPath.size(), projectIdOrPath, groupKey);
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
}
