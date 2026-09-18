package com.specmerger.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Stand-in for {@link MistralVibeClient} when the real mistral-vibe gateway isn't reachable
 * (e.g. working from outside the office network) — see #app.ai.mock in application.yml. Returns
 * the documentation gabarit as-is (placeholders untouched) instead of a filled-in generation, so
 * the rest of the pipeline (diff, markdown editing/versioning, downloads) stays exercisable
 * without a real AI call.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.ai", name = "mock", havingValue = "true")
public class MockSpecResolutionAIProvider implements SpecResolutionAIProvider {

    private static final String DOCUMENTATION_TEMPLATE = loadDocumentationTemplate();

    public MockSpecResolutionAIProvider() {
        log.warn("app.ai.mock=true — SpecResolutionAIProvider is mocked, no call will reach mistral-vibe");
    }

    @Override
    public String proposeResolution(String wordExcerpt, String jxmlExcerpt) {
        return "🧪 [MOCK] Résolution IA simulée (app.ai.mock=true) — à valider manuellement une fois "
                + "mistral-vibe accessible.\n\nWord : " + (wordExcerpt == null ? "(absent)" : wordExcerpt)
                + "\n\nJXML : " + (jxmlExcerpt == null ? "(absent)" : jxmlExcerpt);
    }

    @Override
    public String generateSpecFromJxml(String resolvedJxml) {
        return mockHeader("JXML", resolvedJxml) + DOCUMENTATION_TEMPLATE;
    }

    @Override
    public String generateSpecFromWord(String wordText) {
        return mockHeader("Word", wordText) + DOCUMENTATION_TEMPLATE;
    }

    private String mockHeader(String sourceLabel, String source) {
        return """
                > 🧪 **[MOCK]** Génération simulée depuis %s (app.ai.mock=true, mistral-vibe non appelé) —
                > le gabarit ci-dessous est renvoyé tel quel, placeholders `<...>` non remplis. Source reçue :
                > %d caractères.

                """.formatted(sourceLabel, source == null ? 0 : source.length());
    }

    private static String loadDocumentationTemplate() {
        try (InputStream is = new ClassPathResource("templates/documentation-template.md").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger templates/documentation-template.md", e);
        }
    }
}
