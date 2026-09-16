package com.specmerger.controller;

import com.specmerger.dto.AnalysisSessionResponse;
import com.specmerger.dto.DocumentVersionDto;
import com.specmerger.dto.SaveVersionRequest;
import com.specmerger.entity.DocumentVersion;
import com.specmerger.service.AnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import org.gitlab4j.api.GitLabApiException;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping(consumes = "multipart/form-data")
    public AnalysisSessionResponse analyze(
            @RequestParam(required = false) String title,
            @RequestParam(value = "word", required = false) MultipartFile wordFile,
            @RequestParam(value = "jxmlArchive", required = false) MultipartFile jxmlArchive,
            @RequestParam(value = "jxmlText", required = false) String jxmlText,
            @RequestParam(value = "gitlabProjectId", required = false) String gitlabProjectId) throws IOException, GitLabApiException {
        return analysisService.analyze(title, wordFile, jxmlArchive, jxmlText, gitlabProjectId);
    }

    @GetMapping("/{sessionId}")
    public AnalysisSessionResponse get(@PathVariable UUID sessionId) {
        return analysisService.get(sessionId);
    }

    @GetMapping("/{sessionId}/versions")
    public List<DocumentVersionDto> listVersions(@PathVariable UUID sessionId) {
        return analysisService.listVersions(sessionId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping("/{sessionId}/versions")
    public DocumentVersionDto saveEdit(@PathVariable UUID sessionId, @RequestBody SaveVersionRequest request) {
        return toDto(analysisService.saveEdit(sessionId, request.content()));
    }

    @PostMapping("/{sessionId}/versions/{versionId}/restore")
    public DocumentVersionDto restore(@PathVariable UUID sessionId, @PathVariable UUID versionId) {
        return toDto(analysisService.restore(sessionId, versionId));
    }

    private DocumentVersionDto toDto(DocumentVersion v) {
        return new DocumentVersionDto(v.getId(), v.getVersionNumber(), v.getSource().name(), v.getCreatedAt());
    }
}
