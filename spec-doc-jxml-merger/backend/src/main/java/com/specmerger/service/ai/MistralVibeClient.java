package com.specmerger.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

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

    private final ChatModel chatModel;
    private final String apiKey;

    public MistralVibeClient(ChatModel chatModel, @Value("${spring.ai.mistralai.api-key:}") String apiKey) {
        this.chatModel = chatModel;
        this.apiKey = apiKey;
    }

    @Override
    public String proposeResolution(String wordExcerpt, String jxmlExcerpt) {
        String prompt = """
                Compare ces deux extraits de spécification pour le même écran/fonctionnalité.
                Word (spec fonctionnelle déclarée) : %s
                JXML (code réel) : %s
                Propose la version à retenir dans le markdown final, avec une courte justification.
                """.formatted(
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
