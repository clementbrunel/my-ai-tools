package com.specmerger.controller;

import com.specmerger.dto.GitLabJxmlPreview;
import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import com.specmerger.dto.SpecGenerationResult;
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
        GitLabSourceService.JxmlPreviewResult result =
                resolveJxml(groupKey, projectId, entryPointPath, selectedPaths, selectedPathsProvided);
        return new GitLabJxmlPreview(result.content(), result.warnings());
    }

    /**
     * Resolves the entry point's JXML (same as {@link #previewJxml}) and generates its markdown
     * spec in the same request — one round trip instead of the frontend chaining {@code /preview}
     * into a separate generation call. Read-only, no analysis session is created.
     */
    @GetMapping("/generate-spec")
    public SpecGenerationResult generateSpec(@RequestParam String groupKey, @RequestParam String projectId,
            @RequestParam String entryPointPath,
            @RequestParam(required = false) List<String> selectedPaths,
            @RequestParam(required = false) Boolean selectedPathsProvided) throws GitLabApiException, IOException {
        GitLabSourceService.JxmlPreviewResult resolved =
                resolveJxml(groupKey, projectId, entryPointPath, selectedPaths, selectedPathsProvided);
        return new SpecGenerationResult(aiProvider.generateSpecFromJxml(resolved.content()));
    }

    private GitLabSourceService.JxmlPreviewResult resolveJxml(String groupKey, String projectId,
            String entryPointPath, List<String> selectedPaths, Boolean selectedPathsProvided)
            throws GitLabApiException, IOException {
        // A GET request can't send an explicitly-empty list any other way: "no restriction" and
        // "the user unchecked everything" both arrive as no selectedPaths entries, so the
        // frontend also sends selectedPathsProvided to tell them apart.
        List<String> effectiveSelectedPaths = Boolean.TRUE.equals(selectedPathsProvided)
                ? (selectedPaths == null ? List.of() : selectedPaths)
                : null;
        return gitLabSourceService.previewResolvedJxml(groupKey, projectId, effectiveSelectedPaths, entryPointPath);
    }
}
