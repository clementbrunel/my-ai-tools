package com.specmerger.controller;

import com.specmerger.dto.MergeSpecsRequest;
import com.specmerger.dto.SessionExport;
import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.UpdateDocumentContentRequest;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.entity.GeneratedDocument;
import com.specmerger.service.GeneratedDocumentService;
import com.specmerger.service.HumanSpecParser;
import com.specmerger.service.SessionService;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Generates a markdown spec from a single source — Word/Excel alone, or a GitLab source (see {@link
 * GitLabController#generateSpec}, which resolves the Include chain and generates the spec
 * server-side in one request) — and merges the two into one once both exist. Every generation and
 * merge is persisted ({@link GeneratedDocumentService}) and attached to a {@link SessionService
 * session}, created on the first generation of a new session, so the frontend can keep just the
 * session's id (in localStorage) to recover it later instead of holding the markdown itself — see
 * issue #263. A session is recoverable via {@link #getSession} as soon as its first document
 * exists, whether or not a merge ever happens.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private static final String SAMPLE_WORD_TEXT = loadSampleWordText();

    private final HumanSpecParser humanSpecParser;
    private final SpecResolutionAIProvider aiProvider;
    private final GeneratedDocumentService documentService;
    private final SessionService sessionService;
    private final boolean aiMock;

    public SpecGenerationController(HumanSpecParser humanSpecParser, SpecResolutionAIProvider aiProvider,
                                     GeneratedDocumentService documentService, SessionService sessionService,
                                     @Value("${app.ai.mock:false}") boolean aiMock) {
        this.humanSpecParser = humanSpecParser;
        this.aiProvider = aiProvider;
        this.documentService = documentService;
        this.sessionService = sessionService;
        this.aiMock = aiMock;
    }

    /**
     * {@code word} is optional so the same "Générer la doc" action used for a real upload also
     * covers testing without one: while {@code app.ai.mock} (mistral-vibe mocked) is set, an
     * omitted file falls back to a small bundled sample spec (same démarche as {@code
     * sample-demarche.jxml}) instead of requiring one — mirrors how the mock GitLab project (see
     * {@link com.specmerger.service.gitlab.MockGitLabSourceService}) slots into the normal
     * project list rather than needing a dedicated mock endpoint. Outside mock mode, an omitted
     * file is simply a 400 — there's nothing meaningful to generate from. {@code sessionId} is the
     * frontend's current session, if it already has one (e.g. a JXML doc was generated first) —
     * omitted to start a brand new session.
     */
    @PostMapping(value = "/generate-from-word", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromWord(@RequestParam(value = "word", required = false) MultipartFile word,
                                                  @RequestParam(value = "sessionId", required = false) UUID sessionId)
            throws IOException {
        String markdown = aiProvider.generateSpecFromWord(extractTextOrSample(word));
        GeneratedDocument document = documentService.createWord(markdown);
        UUID resultingSessionId = sessionService.attachWordDocument(sessionId, document.getId());
        return new SpecGenerationResult(document.getId(), markdown, resultingSessionId);
    }

    /**
     * The raw text extracted from the uploaded Word/.doc/.xlsx spec, exactly as it will be sent
     * to the model — read-only, no AI call and nothing persisted.
     */
    @PostMapping(value = "/preview-word", consumes = "multipart/form-data")
    public WordExtractionPreview previewWord(@RequestParam("word") MultipartFile word) throws IOException {
        try (var in = word.getInputStream()) {
            return new WordExtractionPreview(humanSpecParser.extractText(word.getOriginalFilename(), in));
        }
    }

    /**
     * Merges the Word-generated and JXML-generated markdown specs (as currently held by the
     * frontend, edits included) into a single reconciled document, attached to the same session
     * both were generated under.
     */
    @PostMapping("/merge")
    public SpecGenerationResult merge(@RequestBody MergeSpecsRequest request) {
        String markdown = aiProvider.mergeSpecs(request.wordMarkdown(), request.jxmlMarkdown());
        GeneratedDocument document = documentService.createMerged(markdown);
        sessionService.attachMergedDocument(request.sessionId(), document.getId(), request.gitlabSelectionJson());
        return new SpecGenerationResult(document.getId(), markdown, request.sessionId());
    }

    /**
     * Everything needed to recover a session on another machine from just its id — the current
     * content of whichever of its three slots (Word, JXML, merge) exist so far — the navbar's
     * session export/import.
     */
    @GetMapping("/session/{sessionId}")
    public SessionExport getSession(@PathVariable UUID sessionId) {
        return sessionService.getSession(sessionId);
    }

    /** Auto-saves a manual edit as a new revision (debounced on the frontend) — never overwrites. */
    @PutMapping("/documents/{id}")
    public SpecGenerationResult updateDocument(@PathVariable UUID id, @RequestBody UpdateDocumentContentRequest request) {
        documentService.addRevision(id, request.content());
        return new SpecGenerationResult(id, request.content(), null);
    }

    private String extractTextOrSample(MultipartFile word) throws IOException {
        if (word != null && !word.isEmpty()) {
            try (var in = word.getInputStream()) {
                return humanSpecParser.extractText(word.getOriginalFilename(), in);
            }
        }
        if (!aiMock) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Un fichier Word/Excel est requis (sauf en mode mock, MISTRAL_MOCK=true).");
        }
        return SAMPLE_WORD_TEXT;
    }

    private static String loadSampleWordText() {
        try (InputStream is = new ClassPathResource("samples/sample-demarche-word.md").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger samples/sample-demarche-word.md", e);
        }
    }
}
