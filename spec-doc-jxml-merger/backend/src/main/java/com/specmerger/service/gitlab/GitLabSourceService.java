package com.specmerger.service.gitlab;

import com.specmerger.dto.GitLabProjectSummary;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import org.gitlab4j.api.GitLabApiException;
import org.gitlab4j.api.models.Project;
import org.gitlab4j.api.models.TreeItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Browses a subgroup of JWAY projects on GitLab (see #266) and downloads only the
 * files worth sending to the model, replacing the manual zip/paste upload flow.
 */
@Slf4j
@Service
public class GitLabSourceService {

    private final GitLabApiFactory apiFactory;
    private final SourceFileFilter fileFilter;
    private final String subgroup;

    public GitLabSourceService(
            GitLabApiFactory apiFactory,
            SourceFileFilter fileFilter,
            @Value("${gitlab.subgroup:}") String subgroup) {
        this.apiFactory = apiFactory;
        this.fileFilter = fileFilter;
        this.subgroup = subgroup;
    }

    public List<GitLabProjectSummary> listSubgroupProjects() throws GitLabApiException {
        if (subgroup.isBlank()) {
            throw new IllegalStateException("GitLab non configuré : renseigner GITLAB_SUBGROUP (nom ou ID).");
        }
        try (GitLabApi api = apiFactory.create()) {
            List<Project> projects = api.getGroupApi().getProjects(resolveIdentifier(subgroup));
            return projects.stream()
                    .map(p -> new GitLabProjectSummary(
                            p.getId(), p.getName(), p.getPathWithNamespace(), p.getDefaultBranch(), p.getWebUrl()))
                    .toList();
        }
    }

    /**
     * Downloads only the files of the project that {@link SourceFileFilter} deems
     * relevant (JXML sources, translation resources, and — when configured —
     * outbound business-call Java classes), keyed by their repository path.
     */
    public Map<String, String> fetchRelevantSources(String projectIdOrPath) throws GitLabApiException, IOException {
        try (GitLabApi api = apiFactory.create()) {
            Object projectId = resolveIdentifier(projectIdOrPath);
            Project project = api.getProjectApi().getProject(projectId);
            String ref = project.getDefaultBranch();

            List<TreeItem> tree = api.getRepositoryApi().getTree(projectId, "", ref, true);
            Map<String, String> filesByPath = new LinkedHashMap<>();
            for (TreeItem item : tree) {
                if (item.getType() != TreeItem.Type.BLOB || !fileFilter.isRelevant(item.getPath())) {
                    continue;
                }
                try (InputStream raw = api.getRepositoryFileApi().getRawFile(projectId, ref, item.getPath())) {
                    filesByPath.put(item.getPath(), new String(raw.readAllBytes(), StandardCharsets.UTF_8));
                }
            }
            log.info("GitLab: {} fichier(s) retenu(s) sur {} après filtrage", filesByPath.size(), projectIdOrPath);
            return filesByPath;
        }
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
