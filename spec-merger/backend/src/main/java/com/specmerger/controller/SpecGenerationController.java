package com.specmerger.controller;

import com.specmerger.dto.MergeSpecsRequest;
import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.UpdateDocumentContentRequest;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.entity.GeneratedDocument;
import com.specmerger.service.GeneratedDocumentService;
import com.specmerger.service.HumanSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Generates a markdown spec from a single source — Word/Excel alone, or a GitLab source (see {@link
 * GitLabController#generateSpec}, which resolves the Include chain and generates the spec
 * server-side in one request) — and merges the two into one once both exist. Every generation and
 * merge is persisted ({@link GeneratedDocumentService}) so the frontend can keep just the
 * resulting id (in localStorage) to recover a session instead of holding the markdown itself —
 * see issue #263.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private final HumanSpecParser humanSpecParser;
    private final SpecResolutionAIProvider aiProvider;
    private final GeneratedDocumentService documentService;

    public SpecGenerationController(HumanSpecParser humanSpecParser, SpecResolutionAIProvider aiProvider,
                                     GeneratedDocumentService documentService) {
        this.humanSpecParser = humanSpecParser;
        this.aiProvider = aiProvider;
        this.documentService = documentService;
    }

    @PostMapping(value = "/generate-from-word", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromWord(@RequestParam("word") MultipartFile word) throws IOException {
        String text;
        try (var in = word.getInputStream()) {
            text = humanSpecParser.extractText(word.getOriginalFilename(), in);
        }
        String markdown = aiProvider.generateSpecFromWord(text);
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
        GeneratedDocument document =
                documentService.createMerged(markdown, request.wordDocumentId(), request.jxmlDocumentId());
        return new SpecGenerationResult(document.getId(), markdown);
    }

    /** A persisted document's latest content — used to recover a session from its id. */
    @GetMapping("/documents/{id}")
    public SpecGenerationResult getDocument(@PathVariable UUID id) {
        return new SpecGenerationResult(id, documentService.getLatestContent(id));
    }

    /** Auto-saves a manual edit as a new revision (debounced on the frontend) — never overwrites. */
    @PutMapping("/documents/{id}")
    public SpecGenerationResult updateDocument(@PathVariable UUID id, @RequestBody UpdateDocumentContentRequest request) {
        documentService.addRevision(id, request.content());
        return new SpecGenerationResult(id, request.content());
    }
}
