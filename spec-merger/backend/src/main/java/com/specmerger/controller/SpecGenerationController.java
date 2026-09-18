package com.specmerger.controller;

import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.service.WordSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Generates a markdown spec from a single source — Word alone, or a GitLab source (see {@link
 * GitLabController#generateSpec}, which resolves the Include chain and generates the spec
 * server-side in one request). Read-only, no analysis session is created. Backs the single
 * adaptive "Analyser" action: which source is used is decided by the caller, not here — see
 * issue #262. Combining both sources into one diffed spec is not implemented yet.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private final WordSpecParser wordSpecParser;
    private final SpecResolutionAIProvider aiProvider;

    public SpecGenerationController(WordSpecParser wordSpecParser, SpecResolutionAIProvider aiProvider) {
        this.wordSpecParser = wordSpecParser;
        this.aiProvider = aiProvider;
    }

    @PostMapping(value = "/generate-from-word", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromWord(@RequestParam("word") MultipartFile word) throws IOException {
        String text;
        try (var in = word.getInputStream()) {
            text = wordSpecParser.extractText(in);
        }
        return new SpecGenerationResult(aiProvider.generateSpecFromWord(text));
    }

    /**
     * The raw text extracted from the uploaded Word/.doc spec, exactly as it will be sent to the
     * model — read-only, no AI call and no analysis session is created.
     */
    @PostMapping(value = "/preview-word", consumes = "multipart/form-data")
    public WordExtractionPreview previewWord(@RequestParam("word") MultipartFile word) throws IOException {
        try (var in = word.getInputStream()) {
            return new WordExtractionPreview(wordSpecParser.extractText(in));
        }
    }
}
