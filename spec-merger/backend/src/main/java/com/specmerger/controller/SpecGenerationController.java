package com.specmerger.controller;

import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.dto.WordExtractionPreview;
import com.specmerger.service.HumanSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Generates a markdown spec from a single source — Word/Excel alone, or a GitLab source (see {@link
 * GitLabController#generateSpec}, which resolves the Include chain and generates the spec
 * server-side in one request). Read-only, no analysis session is created. Backs the single
 * adaptive "Analyser" action: which source is used is decided by the caller, not here — see
 * issue #262. Combining both sources into one diffed spec is not implemented yet.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private static final String SAMPLE_WORD_TEXT = loadSampleWordText();

    private final HumanSpecParser humanSpecParser;
    private final SpecResolutionAIProvider aiProvider;
    private final boolean aiMock;

    public SpecGenerationController(HumanSpecParser humanSpecParser, SpecResolutionAIProvider aiProvider,
            @Value("${app.ai.mock:false}") boolean aiMock) {
        this.humanSpecParser = humanSpecParser;
        this.aiProvider = aiProvider;
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
        return new SpecGenerationResult(aiProvider.generateSpecFromWord(extractTextOrSample(word)));
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
