package com.specmerger.controller;

import com.specmerger.dto.LinkDocumentsRequest;
import com.specmerger.dto.MergeSpecsRequest;
import com.specmerger.dto.SessionExport;
import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.UpdateDocumentContentRequest;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.entity.GeneratedDocument;
import com.specmerger.service.GeneratedDocumentService;
import com.specmerger.service.HumanSpecParser;
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
 * merge is persisted ({@link GeneratedDocumentService}) so the frontend can keep just the
 * resulting id (in localStorage) to recover a session instead of holding the markdown itself —
 * see issue #263. A session is recoverable as soon as the first document exists: {@link
 * #getSession} works from a lone Word or JXML document's id just as well as from a finished
 * merge's. And once both a Word and a JXML document exist, {@link #link} pairs them so that
 * either one's id recovers both — the pairing an actual merge normally records, made available
 * before (or instead of) ever merging.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private static final String SAMPLE_WORD_TEXT = loadSampleWordText();

    private final HumanSpecParser humanSpecParser;
    private final SpecResolutionAIProvider aiProvider;
    private final GeneratedDocumentService documentService;
    private final boolean aiMock;

    public SpecGenerationController(HumanSpecParser humanSpecParser, SpecResolutionAIProvider aiProvider,
                                     GeneratedDocumentService documentService,
                                     @Value("${app.ai.mock:false}") boolean aiMock) {
        this.humanSpecParser = humanSpecParser;
        this.aiProvider = aiProvider;
        this.documentService = documentService;
        this.aiMock = aiMock;
    }

    /**
     * {@code word} is optional so the same "Générer la doc" action used for a real upload also
     * covers testing without one: while {@code app.ai.mock} (mistral-vibe mocked) is set, an
     * omitted file falls back to a small bundled sample spec (same démarche as {@code
     * sample-demarche.jxml}) instead of requiring one — mirrors how the mock GitLab project (see
     * {@link com.specmerger.service.gitlab.MockGitLabSourceService}) slots into the normal
     * project list rather than needing a dedicated mock endpoint. Outside mock mode, an omitted
     * file is simply a 400 — there's nothing meaningful to generate from.
     */
    @PostMapping(value = "/generate-from-word", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromWord(@RequestParam(value = "word", required = false) MultipartFile word)
            throws IOException {
        String markdown = aiProvider.generateSpecFromWord(extractTextOrSample(word));
        GeneratedDocument document = documentService.createWord(markdown);
        return new SpecGenerationResult(document.getId(), markdown);
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
     * frontend, edits included) into a single reconciled document.
     */
    @PostMapping("/merge")
    public SpecGenerationResult merge(@RequestBody MergeSpecsRequest request) {
        String markdown = aiProvider.mergeSpecs(request.wordMarkdown(), request.jxmlMarkdown());
        GeneratedDocument document = documentService.createMerged(markdown, request.wordDocumentId(),
                request.jxmlDocumentId(), request.gitlabSelectionJson());
        return new SpecGenerationResult(document.getId(), markdown);
    }

    /**
     * Pairs an already-generated Word document with an already-generated JXML document as the
     * same in-progress session, before either is merged — called by the frontend as soon as both
     * slots are filled, so the session becomes recoverable as a pair from just one document's id
     * even if the user never merges them.
     */
    @PutMapping("/link")
    public void link(@RequestBody LinkDocumentsRequest request) {
        documentService.linkCounterparts(request.wordDocumentId(), request.jxmlDocumentId());
    }

    /** A persisted document's latest content — used to recover a session from its id. */
    @GetMapping("/documents/{id}")
    public SpecGenerationResult getDocument(@PathVariable UUID id) {
        return new SpecGenerationResult(id, documentService.getLatestContent(id));
    }

    /**
     * Everything needed to recover a session on another machine from just one document id — a
     * finished merge, or a lone Word/JXML generation with no counterpart to merge with yet — the
     * navbar's session export/import.
     */
    @GetMapping("/session/{documentId}")
    public SessionExport getSession(@PathVariable UUID documentId) {
        return documentService.getSession(documentId);
    }

    /** Auto-saves a manual edit as a new revision (debounced on the frontend) — never overwrites. */
    @PutMapping("/documents/{id}")
    public SpecGenerationResult updateDocument(@PathVariable UUID id, @RequestBody UpdateDocumentContentRequest request) {
        documentService.addRevision(id, request.content());
        return new SpecGenerationResult(id, request.content());
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
