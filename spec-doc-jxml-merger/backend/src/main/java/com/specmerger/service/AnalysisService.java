package com.specmerger.service;

import com.specmerger.dto.AnalysisSessionResponse;
import com.specmerger.dto.DivergenceDraft;
import com.specmerger.dto.DivergenceDto;
import com.specmerger.entity.AnalysisSession;
import com.specmerger.entity.Divergence;
import com.specmerger.entity.DocumentVersion;
import com.specmerger.repository.AnalysisSessionRepository;
import com.specmerger.repository.DivergenceRepository;
import com.specmerger.repository.DocumentVersionRepository;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import com.specmerger.service.gitlab.GitLabSourceService;
import com.specmerger.service.gitlab.TranslationResolver;
import org.gitlab4j.api.GitLabApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AnalysisService {

    private final AnalysisSessionRepository sessionRepository;
    private final DocumentVersionRepository versionRepository;
    private final DivergenceRepository divergenceRepository;
    private final WordSpecParser wordSpecParser;
    private final JxmlSpecParser jxmlSpecParser;
    private final GitLabSourceService gitLabSourceService;
    private final DiffEngine diffEngine;
    private final SpecResolutionAIProvider aiProvider;
    private final MarkdownGenerator markdownGenerator;

    public AnalysisService(AnalysisSessionRepository sessionRepository,
                            DocumentVersionRepository versionRepository,
                            DivergenceRepository divergenceRepository,
                            WordSpecParser wordSpecParser,
                            JxmlSpecParser jxmlSpecParser,
                            GitLabSourceService gitLabSourceService,
                            DiffEngine diffEngine,
                            SpecResolutionAIProvider aiProvider,
                            MarkdownGenerator markdownGenerator) {
        this.sessionRepository = sessionRepository;
        this.versionRepository = versionRepository;
        this.divergenceRepository = divergenceRepository;
        this.wordSpecParser = wordSpecParser;
        this.jxmlSpecParser = jxmlSpecParser;
        this.gitLabSourceService = gitLabSourceService;
        this.diffEngine = diffEngine;
        this.aiProvider = aiProvider;
        this.markdownGenerator = markdownGenerator;
    }

    @Transactional
    public AnalysisSessionResponse analyze(String title, MultipartFile wordFile, MultipartFile jxmlArchive,
                                            String jxmlText, String gitlabGroupKey, String gitlabProjectId,
                                            List<String> gitlabSelectedPaths, String gitlabEntryPointPath)
            throws IOException, GitLabApiException {
        boolean hasWord = wordFile != null && !wordFile.isEmpty();
        boolean hasGitlab = gitlabProjectId != null && !gitlabProjectId.isBlank();
        boolean hasJxml = (jxmlArchive != null && !jxmlArchive.isEmpty()) || (jxmlText != null && !jxmlText.isBlank()) || hasGitlab;
        if (!hasWord && !hasJxml) {
            throw new IllegalArgumentException("Au moins une source (Word ou JXML) est requise.");
        }
        if (hasGitlab && (gitlabGroupKey == null || gitlabGroupKey.isBlank())) {
            throw new IllegalArgumentException("gitlabGroupKey est requis avec gitlabProjectId.");
        }

        String wordText = hasWord ? wordSpecParser.extractText(wordFile.getInputStream()) : "";

        Map<String, String> jxmlFiles;
        AnalysisSession.JxmlSourceType sourceType;
        if (hasGitlab) {
            jxmlFiles = gitLabSourceService.fetchRelevantSources(
                    gitlabGroupKey, gitlabProjectId, gitlabSelectedPaths, gitlabEntryPointPath);
            sourceType = AnalysisSession.JxmlSourceType.GITLAB_PROJECT;
        } else if (jxmlArchive != null && !jxmlArchive.isEmpty()) {
            jxmlFiles = jxmlSpecParser.extractFromZip(jxmlArchive.getInputStream());
            sourceType = AnalysisSession.JxmlSourceType.ZIP_UPLOAD;
        } else {
            jxmlFiles = jxmlSpecParser.fromPastedText(jxmlText == null ? "" : jxmlText);
            sourceType = AnalysisSession.JxmlSourceType.PASTED_TEXT;
        }
        // Translation resources (.properties/.xlf) ride along with the JXML sources when they
        // come from GitLab (#266/#283) — they resolve trans(...) keys (#285) but aren't
        // themselves JXML content, so they're excluded from what's actually diffed/analyzed.
        Map<String, String> translations = gitLabSourceService.resolveTranslations(jxmlFiles);
        String concatenatedJxmlText = TranslationResolver.resolve(jxmlFiles.entrySet().stream()
                .filter(entry -> !TranslationResolver.isTranslationFile(entry.getKey()))
                .map(Map.Entry::getValue)
                .collect(Collectors.joining("\n")), translations);

        AnalysisSession session = new AnalysisSession();
        session.setTitle(title);
        session.setWordFilename(hasWord ? wordFile.getOriginalFilename() : null);
        session.setJxmlSourceType(sourceType);
        session.setJxmlFilename(hasGitlab ? gitlabGroupKey + ":" + gitlabProjectId
                : jxmlArchive != null ? jxmlArchive.getOriginalFilename() : null);
        session.setStatus(AnalysisSession.AnalysisStatus.CREATED);
        session = sessionRepository.save(session);

        List<DivergenceDraft> drafts = diffEngine.diff(wordText, concatenatedJxmlText);

        AnalysisSession finalSession = session;
        List<Divergence> divergences = drafts.stream().map(draft -> {
            Divergence d = new Divergence();
            d.setSession(finalSession);
            d.setSectionRef(draft.sectionRef());
            d.setWordExcerpt(draft.wordExcerpt());
            d.setJxmlExcerpt(draft.jxmlExcerpt());
            d.setAiProposal(aiProvider.proposeResolution(draft.wordExcerpt(), draft.jxmlExcerpt()));
            return divergenceRepository.save(d);
        }).collect(Collectors.toList());

        String markdown = markdownGenerator.generate(title, divergences);

        DocumentVersion version = new DocumentVersion();
        version.setSession(session);
        version.setVersionNumber(1);
        version.setContent(markdown);
        version.setSource(DocumentVersion.VersionSource.GENERATED);
        versionRepository.save(version);

        session.setStatus(AnalysisSession.AnalysisStatus.ANALYZED);
        session.setUpdatedAt(Instant.now());
        sessionRepository.save(session);

        return toResponse(session, markdown, divergences);
    }

    @Transactional(readOnly = true)
    public AnalysisSessionResponse get(UUID sessionId) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
        DocumentVersion latest = versionRepository.findTopBySessionIdOrderByVersionNumberDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("Aucune version pour la session " + sessionId));
        List<Divergence> divergences = divergenceRepository.findBySessionId(sessionId);
        return toResponse(session, latest.getContent(), divergences);
    }

    @Transactional
    public DocumentVersion saveEdit(UUID sessionId, String content) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
        int nextVersion = nextVersionNumber(sessionId);

        DocumentVersion version = new DocumentVersion();
        version.setSession(session);
        version.setVersionNumber(nextVersion);
        version.setContent(content);
        version.setSource(DocumentVersion.VersionSource.MANUAL_EDIT);
        return versionRepository.save(version);
    }

    @Transactional
    public DocumentVersion restore(UUID sessionId, UUID versionId) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session introuvable: " + sessionId));
        DocumentVersion target = versionRepository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Version introuvable: " + versionId));
        int nextVersion = nextVersionNumber(sessionId);

        DocumentVersion restored = new DocumentVersion();
        restored.setSession(session);
        restored.setVersionNumber(nextVersion);
        restored.setContent(target.getContent());
        restored.setSource(DocumentVersion.VersionSource.RESTORED);
        return versionRepository.save(restored);
    }

    @Transactional(readOnly = true)
    public List<DocumentVersion> listVersions(UUID sessionId) {
        return versionRepository.findBySessionIdOrderByVersionNumberDesc(sessionId);
    }

    private int nextVersionNumber(UUID sessionId) {
        return versionRepository.findTopBySessionIdOrderByVersionNumberDesc(sessionId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);
    }

    private AnalysisSessionResponse toResponse(AnalysisSession session, String markdown, List<Divergence> divergences) {
        List<DivergenceDto> divergenceDtos = divergences.stream()
                .map(d -> new DivergenceDto(
                        d.getId(), d.getSectionRef(), d.getWordExcerpt(), d.getJxmlExcerpt(),
                        d.getAiProposal(), d.getResolutionStatus().name(), d.getResolvedValue()))
                .collect(Collectors.toList());
        return new AnalysisSessionResponse(
                session.getId(), session.getTitle(), session.getStatus().name(), markdown, divergenceDtos);
    }
}
