package com.specmerger.service.ai;

import com.specmerger.service.JxmlTagDocRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Supplier;

/**
 * Client for the internal mistral-vibe gateway (proxy in front of the Mistral
 * chat-completions API). Uses Spring AI's Mistral integration, autoconfigured
 * from spring.ai.mistralai.* — see application.yml. The raw HTTP exchange is
 * logged by {@link MistralHttpLoggingConfig}; this class only adds business
 * context (which excerpt is being resolved) to avoid logging the same
 * request/response content twice.
 *
 * <p>Each call sends a {@link SystemMessage} carrying the stable task instructions and
 * JWAY tag documentation, and a {@link UserMessage} carrying only the excerpt being
 * processed (JXML or Word text) — separating the two mirrors how the chat-completions
 * API is meant to be used and keeps the door open for the gateway to cache the mostly
 * static system content across calls.
 */
@Slf4j
@Component
public class MistralVibeClient implements SpecResolutionAIProvider {

    private static final int MAX_TAG_DOCS = 5;
    private static final int MAX_TAG_DOCS_CHARS = 6000;

    // A full-démarche generation call covers many more tags at once than a single divergence
    // excerpt — give it a much bigger context budget.
    private static final int MAX_TAG_DOCS_SPEC_GENERATION = 20;
    private static final int MAX_TAG_DOCS_CHARS_SPEC_GENERATION = 40_000;

    // Shared by generateSpecFromJxml and generateSpecFromWord so both sides of a démarche
    // are structured the same way (see templates/documentation-template.md and issues
    // #260/#263) — the screen-level diff only works if the two independently generated
    // markdowns follow the same section/table shape. Static/stable, so it belongs in the
    // system message alongside the JWAY tag context, not repeated per call in the user message.
    private static final String DOCUMENTATION_TEMPLATE = loadDocumentationTemplate();

    // Shared instruction for generateSpecFromJxml/generateSpecFromWord: both must always produce
    // the whole gabarit (not a subset — see the "Un seul gabarit pour les deux sources" rule at
    // the top of documentation-template.md), leaving what a given source can't fill as
    // "Non renseigné" rather than omitting it, so the two independently generated markdowns stay
    // structurally comparable however incomplete either one is. Kept in one place so both prompts
    // stay in sync if this instruction changes.
    private static final String TEMPLATE_FOLLOW_INSTRUCTION =
            "en suivant IMPÉRATIVEMENT le gabarit ci-dessus, dans son intégralité et dans le même "
            + "ordre : ne saute aucune section même si cette source ne permet pas de la remplir — "
            + "indique alors « _Non renseigné dans la source._ » (ou une ligne de tableau vide) "
            + "plutôt que de l'omettre, comme le gabarit le demande.";

    private final ChatModel chatModel;
    private final String apiKey;
    private final JxmlTagDocRepository tagDocRepository;

    public MistralVibeClient(ChatModel chatModel, @Value("${spring.ai.mistralai.api-key:}") String apiKey,
                              JxmlTagDocRepository tagDocRepository) {
        this.chatModel = chatModel;
        this.apiKey = apiKey;
        this.tagDocRepository = tagDocRepository;
    }

    @Override
    public String proposeResolution(String wordExcerpt, String jxmlExcerpt) {
        String system = """
                %sCompare ces deux extraits de spécification pour le même écran/fonctionnalité.
                Propose la version à retenir dans le markdown final, avec une courte justification.
                """.formatted(buildTagContext(jxmlExcerpt));
        String user = """
                Word (spec fonctionnelle déclarée) : %s
                JXML (code réel) : %s
                """.formatted(
                wordExcerpt == null ? "(absent)" : wordExcerpt,
                jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);

        log.debug("mistral-vibe resolving divergence: word={} chars, jxml={} chars",
                wordExcerpt == null ? 0 : wordExcerpt.length(),
                jxmlExcerpt == null ? 0 : jxmlExcerpt.length());
        Prompt prompt = new Prompt(List.of(new SystemMessage(system), new UserMessage(user)));
        return call(prompt, () -> fallback(wordExcerpt, jxmlExcerpt));
    }

    @Override
    public String generateSpecFromJxml(String resolvedJxml) {
        Prompt prompt = buildJxmlSpecPrompt(resolvedJxml);
        log.debug("mistral-vibe generating spec from JXML: {} chars",
                resolvedJxml == null ? 0 : resolvedJxml.length());
        return call(prompt, () -> jxmlSpecFallback(resolvedJxml));
    }

    @Override
    public String generateSpecFromWord(String wordText) {
        Prompt prompt = buildWordSpecPrompt(wordText);
        log.debug("mistral-vibe generating spec from Word: {} chars", wordText == null ? 0 : wordText.length());
        return call(prompt, () -> wordSpecFallback(wordText));
    }

    /** Shared call/fallback path for the three prompt methods above: same retry-free error
     * handling, only the prompt and the fallback message differ. */
    private String call(Prompt prompt, Supplier<String> fallback) {
        try {
            ChatResponse response = chatModel.call(prompt);
            String content = response.getResult() != null ? response.getResult().getOutput().getText() : null;
            return content != null && !content.isBlank() ? content : fallback.get();
        } catch (Exception e) {
            log.error("mistral-vibe call failed (api-key \"{}\"): {}", maskedApiKey(), e.getMessage(), e);
            return fallback.get();
        }
    }

    Prompt buildJxmlSpecPrompt(String resolvedJxml) {
        String safeJxml = resolvedJxml == null ? "" : resolvedJxml;
        String tagContext = buildSpecGenerationTagContext(safeJxml);
        String system = """
                %s

                %sTu es assisté par la documentation JWAY ci-dessus pour comprendre les balises propriétaires.
                Génère la documentation markdown de ce formulaire à partir du JXML fourni (les fragments
                <Include> ont déjà été résolus et intégrés), %s
                Un écran correspond à une <Section NewPage="screen"> de premier niveau sous <JForm> ; les
                <Section NewPage="none"> imbriquées restent dans le même écran que leur section parente.
                Reprends le titre de chaque écran depuis sa balise <Title>.
                Pour chaque champ, base la colonne Type/le comportement (obligatoire, visibilité conditionnelle,
                contrôles de validation) sur les attributs réels du JXML plutôt que sur des suppositions, et
                l'ID sur son libellé résolu comme l'exige le gabarit.
                Les appels trans(...) encore présents dans ce JXML référencent des clés de traduction pour
                lesquelles aucune correspondance n'a été trouvée dans les fichiers de traduction sélectionnés
                (voir #285) : laisse-les tels quels plutôt que de deviner leur contenu — y compris comme ID
                quand le libellé d'un champ n'est qu'un appel trans(...) non résolu.
                """.formatted(DOCUMENTATION_TEMPLATE, tagContext, TEMPLATE_FOLLOW_INSTRUCTION);
        String user = "JXML :\n" + safeJxml;
        return new Prompt(List.of(new SystemMessage(system), new UserMessage(user)));
    }

    Prompt buildWordSpecPrompt(String wordText) {
        String safeWord = wordText == null ? "" : wordText;
        String system = """
                %s

                Restructure ce texte extrait d'une spécification Word/Excel en documentation markdown, %s
                Respecte le même ordre d'apparition des sections/écrans que dans le document d'origine, et
                décris les champs et comportements tels que déclarés dans le texte, sans y ajouter d'information
                absente.
                """.formatted(DOCUMENTATION_TEMPLATE, TEMPLATE_FOLLOW_INSTRUCTION);
        String user = "Texte extrait :\n" + safeWord;
        return new Prompt(List.of(new SystemMessage(system), new UserMessage(user)));
    }

    private static String loadDocumentationTemplate() {
        try (InputStream is = new ClassPathResource("templates/documentation-template.md").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger templates/documentation-template.md", e);
        }
    }

    private String jxmlSpecFallback(String resolvedJxml) {
        return "⚠️ Génération IA indisponible — JXML source à documenter manuellement :\n"
                + (resolvedJxml == null ? "(absent)" : resolvedJxml);
    }

    private String wordSpecFallback(String wordText) {
        return "⚠️ Génération IA indisponible — texte Word à documenter manuellement :\n"
                + (wordText == null ? "(absent)" : wordText);
    }

    private String buildTagContext(String jxmlExcerpt) {
        List<String> docs = tagDocRepository.findRelevantDocs(jxmlExcerpt, MAX_TAG_DOCS, MAX_TAG_DOCS_CHARS);
        if (docs.isEmpty()) {
            return "";
        }
        return "Documentation des balises JWAY détectées dans l'extrait JXML ci-dessous :\n"
                + String.join("\n---\n", docs) + "\n\n";
    }

    private String buildSpecGenerationTagContext(String jxmlText) {
        List<String> docs = tagDocRepository.findRelevantDocs(
                jxmlText, MAX_TAG_DOCS_SPEC_GENERATION, MAX_TAG_DOCS_CHARS_SPEC_GENERATION);
        if (docs.isEmpty()) {
            return "";
        }
        return "Documentation des balises JWAY détectées dans ce JXML :\n"
                + String.join("\n---\n", docs) + "\n\n";
    }

    private String maskedApiKey() {
        if (apiKey == null || apiKey.isEmpty()) {
            return "(empty)";
        }
        int visible = Math.min(3, apiKey.length());
        return "?".repeat(apiKey.length() - visible) + apiKey.substring(apiKey.length() - visible);
    }

    private String fallback(String wordExcerpt, String jxmlExcerpt) {
        return "⚠️ Résolution IA indisponible — à trancher manuellement. Word: "
                + (wordExcerpt == null ? "(absent)" : wordExcerpt)
                + " | JXML: "
                + (jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);
    }
}
