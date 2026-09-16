package com.specmerger.service.ai;

import com.specmerger.service.JxmlTagDocRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Client for the internal mistral-vibe gateway (proxy in front of the Mistral
 * chat-completions API). Uses Spring AI's Mistral integration, autoconfigured
 * from spring.ai.mistralai.* — see application.yml. The raw HTTP exchange is
 * logged by {@link MistralHttpLoggingConfig}; this class only adds business
 * context (which excerpt is being resolved) to avoid logging the same
 * request/response content twice.
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
        String prompt = """
                %sCompare ces deux extraits de spécification pour le même écran/fonctionnalité.
                Word (spec fonctionnelle déclarée) : %s
                JXML (code réel) : %s
                Propose la version à retenir dans le markdown final, avec une courte justification.
                """.formatted(
                buildTagContext(jxmlExcerpt),
                wordExcerpt == null ? "(absent)" : wordExcerpt,
                jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);

        log.debug("mistral-vibe resolving divergence: word={} chars, jxml={} chars",
                wordExcerpt == null ? 0 : wordExcerpt.length(),
                jxmlExcerpt == null ? 0 : jxmlExcerpt.length());
        try {
            ChatResponse response = chatModel.call(new Prompt(new UserMessage(prompt)));
            String content = response.getResult() != null ? response.getResult().getOutput().getText() : null;
            return content != null && !content.isBlank() ? content : fallback(wordExcerpt, jxmlExcerpt);
        } catch (Exception e) {
            log.error("mistral-vibe call failed (api-key \"{}\"): {}", maskedApiKey(), e.getMessage(), e);
            return fallback(wordExcerpt, jxmlExcerpt);
        }
    }

    @Override
    public String generateSpecFromJxml(String resolvedJxml) {
        String prompt = buildJxmlSpecPrompt(resolvedJxml);
        log.debug("mistral-vibe generating spec from JXML: {} chars",
                resolvedJxml == null ? 0 : resolvedJxml.length());
        try {
            ChatResponse response = chatModel.call(new Prompt(new UserMessage(prompt)));
            String content = response.getResult() != null ? response.getResult().getOutput().getText() : null;
            return content != null && !content.isBlank() ? content : jxmlSpecFallback(resolvedJxml);
        } catch (Exception e) {
            log.error("mistral-vibe call failed (api-key \"{}\"): {}", maskedApiKey(), e.getMessage(), e);
            return jxmlSpecFallback(resolvedJxml);
        }
    }

    @Override
    public String generateSpecFromWord(String wordText) {
        String prompt = buildWordSpecPrompt(wordText);
        log.debug("mistral-vibe generating spec from Word: {} chars", wordText == null ? 0 : wordText.length());
        try {
            ChatResponse response = chatModel.call(new Prompt(new UserMessage(prompt)));
            String content = response.getResult() != null ? response.getResult().getOutput().getText() : null;
            return content != null && !content.isBlank() ? content : wordSpecFallback(wordText);
        } catch (Exception e) {
            log.error("mistral-vibe call failed (api-key \"{}\"): {}", maskedApiKey(), e.getMessage(), e);
            return wordSpecFallback(wordText);
        }
    }

    String buildJxmlSpecPrompt(String resolvedJxml) {
        String safeJxml = resolvedJxml == null ? "" : resolvedJxml;
        List<String> docs = tagDocRepository.findRelevantDocs(
                safeJxml, MAX_TAG_DOCS_SPEC_GENERATION, MAX_TAG_DOCS_CHARS_SPEC_GENERATION);
        String tagContext = docs.isEmpty() ? "" : "Documentation des balises JWAY détectées dans ce JXML :\n"
                + String.join("\n---\n", docs) + "\n\n";
        return """
                %sTu es assisté par la documentation JWAY ci-dessus pour comprendre les balises propriétaires.
                Génère la documentation markdown de ce formulaire à partir du JXML suivant (les fragments
                <Include> ont déjà été résolus et intégrés).
                Découpe le résultat par écran : un écran correspond à une <Section NewPage="screen"> de premier
                niveau sous <JForm> ; les <Section NewPage="none"> imbriquées restent dans le même écran que leur
                section parente.
                Pour chaque écran, utilise un titre de niveau 2 (## Nom de l'écran, repris de sa balise <Title>),
                puis décris les champs et leur comportement (obligatoire, visibilité conditionnelle, contrôles de
                validation) en te basant sur les attributs réels du JXML plutôt que sur des suppositions.
                Les appels trans(...) référencent des clés de traduction externes non résolues ici : laisse-les
                telles quelles plutôt que de deviner leur contenu.

                JXML :
                %s
                """.formatted(tagContext, safeJxml);
    }

    String buildWordSpecPrompt(String wordText) {
        String safeWord = wordText == null ? "" : wordText;
        return """
                Restructure ce texte extrait d'une spécification Word/Excel en documentation markdown, découpée
                par écran ou fonctionnalité dans le même ordre que le document d'origine.
                Pour chaque écran, utilise un titre de niveau 2 (## Nom de l'écran) puis décris les champs et
                comportements attendus tels que déclarés dans le texte, sans y ajouter d'information absente.

                Texte extrait :
                %s
                """.formatted(safeWord);
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
