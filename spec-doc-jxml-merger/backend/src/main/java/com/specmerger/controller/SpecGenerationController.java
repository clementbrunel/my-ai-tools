package com.specmerger.controller;

import com.specmerger.dto.GenerateFromJxmlRequest;
import com.specmerger.dto.SpecGenerationResult;
import com.specmerger.service.WordSpecParser;
import com.specmerger.service.ai.SpecResolutionAIProvider;
import java.io.IOException;
import java.io.StringReader;
import java.util.regex.Pattern;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.InputSource;

/**
 * Generates a markdown spec from a single source — Word alone, or a JXML text alone (hand-pasted,
 * so held to a strict validity bar — see {@link #validateJxmlText}). A GitLab source has its own
 * one-request endpoint, {@link GitLabController#generateSpec}, which resolves the Include chain
 * and generates the spec server-side instead of the frontend chaining two calls. Read-only, no
 * analysis session is created. Backs the single adaptive "Analyser" action: which source is used
 * is decided by the caller, not here — see issue #262. Combining both sources into one diffed
 * spec is not implemented yet.
 */
@RestController
@RequestMapping("/api/spec")
public class SpecGenerationController {

    // Pasted-text JXML has no way to resolve <Include> fragments — that needs the full file set
    // (see JxmlIncludeResolver / the GitLab source) — so it's rejected outright rather than sent
    // to the model half-resolved.
    private static final Pattern INCLUDE_TAG = Pattern.compile("<Include\\b", Pattern.CASE_INSENSITIVE);

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

    @PostMapping("/generate-from-jxml")
    public SpecGenerationResult generateFromJxml(@RequestBody GenerateFromJxmlRequest request) {
        return new SpecGenerationResult(aiProvider.generateSpecFromJxml(validateJxmlText(request.jxmlText())));
    }

    /**
     * Unlike JXML scanned from a real GitLab repo (which isn't guaranteed well-formed — see
     * FormsEntryPointParser/JxmlIncludeResolver), text pasted here is a deliberate one-off test
     * input, so it's held to a stricter bar: must be well-formed XML, and must not reference
     * Include fragments this endpoint has no way to resolve.
     */
    String validateJxmlText(String jxmlText) {
        if (jxmlText == null || jxmlText.isBlank()) {
            throw new IllegalArgumentException("jxmlText est requis pour générer la doc depuis le JXML.");
        }
        if (INCLUDE_TAG.matcher(jxmlText).find()) {
            throw new IllegalArgumentException(
                    "Le JXML collé contient des balises <Include>, non résolvables sans les autres fichiers "
                            + "du projet — utilise le mode GitLab pour un JXML avec des Include.");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.newDocumentBuilder().parse(new InputSource(new StringReader(jxmlText)));
        } catch (Exception e) {
            throw new IllegalArgumentException("Le JXML collé n'est pas un XML valide : " + e.getMessage());
        }
        return jxmlText;
    }
}
