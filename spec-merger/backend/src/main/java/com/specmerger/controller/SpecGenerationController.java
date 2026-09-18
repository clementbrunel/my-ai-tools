package com.specmerger.controller;

import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.service.WordSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Generates a markdown spec from a single source — Word alone, JXML pasted directly (no GitLab
 * project needed), or a GitLab source (see {@link GitLabController#generateSpec}, which resolves
 * the Include chain and generates the spec server-side in one request). Read-only, no analysis
 * session is created. Backs the single adaptive "Analyser" action: which source is used is
 * decided by the caller, not here — see issue #262. Combining both sources into one diffed spec
 * is not implemented yet.
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
     * Same generation as {@link GitLabController#generateSpec}, but for JXML pasted directly in
     * the UI instead of resolved from a GitLab project — no Include chain to flatten since a
     * paste is already a single self-contained document, same as {@link
     * com.specmerger.service.JxmlSpecParser#fromPastedText}.
     */
    @PostMapping(value = "/generate-from-jxml", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromJxml(@RequestParam("jxmlText") String jxmlText) {
        return new SpecGenerationResult(aiProvider.generateSpecFromJxml(jxmlText));
    }

    /**
     * A small, self-contained démarche (2 écrans, quelques champs représentatifs) à coller dans
     * l'input JXML — permet d'exercer le pipeline (génération) sans projet GitLab à disposition,
     * ex. en travaillant hors du réseau du bureau.
     */
    @GetMapping(value = "/sample-jxml", produces = MediaType.TEXT_PLAIN_VALUE)
    public String sampleJxml() {
        try (InputStream is = new ClassPathResource("samples/sample-demarche.jxml").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger samples/sample-demarche.jxml", e);
        }
    }
}
