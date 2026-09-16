package com.specmerger.controller;

import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.service.JxmlSpecParser;
import com.specmerger.service.WordSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Generates a markdown spec from a single source — Word alone, or JXML alone (uploaded archive
 * or pasted text; the GitLab source's equivalent is {@link GitLabController#previewSpec}, which
 * additionally resolves Include fragments). Read-only, no analysis session is created. Backs the
 * single adaptive "Générer la doc" action: which source is used is decided by the caller, not
 * here — see issue #262. Combining both sources into one diffed spec is not implemented yet.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    private final WordSpecParser wordSpecParser;
    private final JxmlSpecParser jxmlSpecParser;
    private final SpecResolutionAIProvider aiProvider;

    public SpecGenerationController(WordSpecParser wordSpecParser, JxmlSpecParser jxmlSpecParser,
                                     SpecResolutionAIProvider aiProvider) {
        this.wordSpecParser = wordSpecParser;
        this.jxmlSpecParser = jxmlSpecParser;
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

    @PostMapping(value = "/generate-from-jxml", consumes = "multipart/form-data")
    public SpecGenerationResult generateFromJxml(
            @RequestParam(value = "jxmlArchive", required = false) MultipartFile jxmlArchive,
            @RequestParam(value = "jxmlText", required = false) String jxmlText) throws IOException {
        return new SpecGenerationResult(aiProvider.generateSpecFromJxml(resolveJxmlText(jxmlArchive, jxmlText)));
    }

    /**
     * Zip/pasted-text JXML has no entry point or Include resolution (that's GitLab-only, see
     * JxmlIncludeResolver) — every .jxml file in the archive is just concatenated, same
     * simplicity level as the rest of {@link JxmlSpecParser}.
     */
    String resolveJxmlText(MultipartFile jxmlArchive, String jxmlText) throws IOException {
        if (jxmlArchive != null && !jxmlArchive.isEmpty()) {
            Map<String, String> filesByPath = jxmlSpecParser.extractFromZip(jxmlArchive.getInputStream());
            return String.join("\n\n", filesByPath.values());
        }
        if (jxmlText != null && !jxmlText.isBlank()) {
            return jxmlText;
        }
        throw new IllegalArgumentException("jxmlArchive ou jxmlText est requis pour générer la doc depuis le JXML.");
    }
}
