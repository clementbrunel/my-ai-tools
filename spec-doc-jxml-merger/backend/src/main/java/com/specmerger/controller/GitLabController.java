package com.specmerger.controller;

import com.specmerger.dto.GitLabJxmlPreview;
import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import com.specmerger.dto.GitLabSpecPreview;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import com.specmerger.service.gitlab.GitLabSourceService;
import java.io.IOException;
import java.util.List;
import org.gitlab4j.api.GitLabApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gitlab")
public class GitLabController {

    private final GitLabSourceService gitLabSourceService;
    private final SpecResolutionAIProvider aiProvider;

    public GitLabController(GitLabSourceService gitLabSourceService, SpecResolutionAIProvider aiProvider) {
        this.gitLabSourceService = gitLabSourceService;
        this.aiProvider = aiProvider;
    }

    @GetMapping("/projects")
    public List<GitLabProjectSummary> listProjects() throws GitLabApiException {
        return gitLabSourceService.listAllProjects();
    }

    /** Paths only, no content — lets the user pick which files to actually include before analysis. */
    @GetMapping("/sources")
    public GitLabSourceListing listSources(@RequestParam String groupKey, @RequestParam String projectId) throws GitLabApiException {
        return gitLabSourceService.listRelevantSourcePaths(groupKey, projectId);
    }

    /**
     * The flattened JXML (entry point + its Include chain resolved) exactly as it will be
     * sent to the model — read-only, no analysis session is created.
     */
    @GetMapping("/preview")
    public GitLabJxmlPreview previewJxml(@RequestParam String groupKey, @RequestParam String projectId,
            @RequestParam String entryPointPath,
            @RequestParam(required = false) List<String> selectedPaths,
            @RequestParam(required = false) Boolean selectedPathsProvided) throws GitLabApiException, IOException {
        // Same null-vs-empty-list disambiguation as AnalysisController: a GET request can't
        // tell "no restriction" from "the user unchecked everything" any other way.
        List<String> effectiveSelectedPaths = Boolean.TRUE.equals(selectedPathsProvided)
                ? (selectedPaths == null ? List.of() : selectedPaths)
                : null;
        GitLabSourceService.JxmlPreviewResult result =
                gitLabSourceService.previewResolvedJxml(groupKey, projectId, effectiveSelectedPaths, entryPointPath);
        return new GitLabJxmlPreview(result.content(), result.warnings());
    }

    /**
     * The markdown spec the model generates from the resolved JXML alone — lets the user
     * validate {@link SpecResolutionAIProvider#generateSpecFromJxml} on a real démarche before
     * it's combined with the Word-derived spec in the diff pipeline (see issue #262). Read-only,
     * no analysis session is created.
     */
    @GetMapping("/preview-spec")
    public GitLabSpecPreview previewSpec(@RequestParam String groupKey, @RequestParam String projectId,
            @RequestParam String entryPointPath,
            @RequestParam(required = false) List<String> selectedPaths,
            @RequestParam(required = false) Boolean selectedPathsProvided) throws GitLabApiException, IOException {
        List<String> effectiveSelectedPaths = Boolean.TRUE.equals(selectedPathsProvided)
                ? (selectedPaths == null ? List.of() : selectedPaths)
                : null;
        GitLabSourceService.JxmlPreviewResult resolved =
                gitLabSourceService.previewResolvedJxml(groupKey, projectId, effectiveSelectedPaths, entryPointPath);
        return new GitLabSpecPreview(aiProvider.generateSpecFromJxml(resolved.content()));
    }
}
