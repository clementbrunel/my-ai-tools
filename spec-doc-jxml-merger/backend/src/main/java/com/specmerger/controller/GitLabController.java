package com.specmerger.controller;

import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.service.gitlab.GitLabSourceService;
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

    public GitLabController(GitLabSourceService gitLabSourceService) {
        this.gitLabSourceService = gitLabSourceService;
    }

    @GetMapping("/projects")
    public List<GitLabProjectSummary> listProjects() throws GitLabApiException {
        return gitLabSourceService.listAllProjects();
    }

    /** Paths only, no content — lets the user pick which files to actually include before analysis. */
    @GetMapping("/sources")
    public List<String> listSources(@RequestParam String groupKey, @RequestParam String projectId) throws GitLabApiException {
        return gitLabSourceService.listRelevantSourcePaths(groupKey, projectId);
    }
}
