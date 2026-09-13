package com.specmerger.service.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Client for the internal mistral-vibe API. The exact request/response payload
 * shape is not confirmed yet, so this issues a best-effort chat-completion-style
 * call and falls back to an explicit placeholder on any failure — the rest of the
 * pipeline keeps working while the real contract gets confirmed.
 */
@Component
public class MistralVibeClient implements SpecResolutionAIProvider {

    private final RestClient restClient;

    public MistralVibeClient(
            @Value("${mistral-vibe.base-url}") String baseUrl,
            @Value("${mistral-vibe.api-key}") String apiKey) {
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    @Override
    public String proposeResolution(String wordExcerpt, String jxmlExcerpt) {
        try {
            String prompt = """
                    Compare ces deux extraits de spécification pour le même écran/fonctionnalité.
                    Word (spec fonctionnelle déclarée) : %s
                    JXML (code réel) : %s
                    Propose la version à retenir dans le markdown final, avec une courte justification.
                    """.formatted(
                    wordExcerpt == null ? "(absent)" : wordExcerpt,
                    jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);

            Map<?, ?> response = restClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("messages", List.of(Map.of("role", "user", "content", prompt))))
                    .retrieve()
                    .body(Map.class);

            Object content = extractContent(response);
            return content != null ? content.toString() : fallback(wordExcerpt, jxmlExcerpt);
        } catch (Exception e) {
            return fallback(wordExcerpt, jxmlExcerpt);
        }
    }

    @SuppressWarnings("unchecked")
    private Object extractContent(Map<?, ?> response) {
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            return message.get("content");
        } catch (Exception e) {
            return null;
        }
    }

    private String fallback(String wordExcerpt, String jxmlExcerpt) {
        return "⚠️ Résolution IA indisponible — à trancher manuellement. Word: "
                + (wordExcerpt == null ? "(absent)" : wordExcerpt)
                + " | JXML: "
                + (jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);
    }
}
