package com.specmerger.controller;

import com.specmerger.dto.MergeSpecsRequest;
import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.service.HumanSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Generates a markdown spec from a single source — Word/Excel alone, or a GitLab source (see {@link
 * GitLabController#generateSpec}, which resolves the Include chain and generates the spec
 * server-side in one request) — and merges the two into one once both exist. Read-only/stateless:
 * no analysis session or persistence, the caller (frontend) holds the markdown on both sides,
 * including any manual edit made before merging — see issue #263.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private final HumanSpecParser humanSpecParser;
    private final SpecResolutionAIProvider aiProvider;

    public SpecGenerationController(HumanSpecParser humanSpecParser, SpecResolutionAIProvider aiProvider) {
        this.humanSpecParser = humanSpecParser;
        this.aiProvider = aiProvider;
    }

    @PostMapping(value = "/generate-from-word", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromWord(@RequestParam("word") MultipartFile word) throws IOException {
        String text;
        try (var in = word.getInputStream()) {
            text = humanSpecParser.extractText(word.getOriginalFilename(), in);
        }
        return new SpecGenerationResult(aiProvider.generateSpecFromWord(text));
    }

    /**
     * The raw text extracted from the uploaded Word/.doc/.xlsx spec, exactly as it will be sent
     * to the model — read-only, no AI call and no analysis session is created.
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
        return new SpecGenerationResult(aiProvider.mergeSpecs(request.wordMarkdown(), request.jxmlMarkdown()));
    }
}
