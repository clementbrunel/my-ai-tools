package com.specmerger.service.ai;

import com.specmerger.service.JxmlTagDocRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client for the internal mistral-vibe gateway (proxy in front of the Mistral
 * chat-completions API). Uses Spring AI's Mistral integration, autoconfigured
 * from spring.ai.mistralai.* — see application.yml. The raw HTTP exchange is
 * logged by {@link MistralHttpLoggingConfig}; this class only adds business
 * context (which source is being processed) to avoid logging the same
 * request/response content twice.
 *
 * <p>Each call sends a {@link SystemMessage} carrying the stable task instructions and
 * JWAY tag documentation, and a {@link UserMessage} carrying only the source content being
 * processed (JXML, Word text, or both markdowns to merge) — separating the two mirrors how
 * the chat-completions API is meant to be used and keeps the door open for the gateway to
 * cache the mostly static system content across calls.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.ai", name = "mock", havingValue = "false", matchIfMissing = true)
public class MistralVibeClient implements SpecResolutionAIProvider {

    private static final int MAX_TAG_DOCS_SPEC_GENERATION = 30;
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

    // The gabarit instructs the model to escape `|` inside JWAY expressions such as
    // `$(data|demandePersonnelle)=='NON'` (see documentation-template.md), but that instruction
    // alone isn't reliable enough — the model regularly forgets it, breaking the markdown table
    // structure. Those expressions always land inside a backtick code span, so as a deterministic
    // safety net, escape any unescaped `|` found inside a code span on a table row line, regardless
    // of what the model actually did.
    private static final Pattern CODE_SPAN = Pattern.compile("`[^`\n]*`");

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
    public String generateSpecFromJxml(String resolvedJxml) {
        Prompt prompt = buildJxmlSpecPrompt(resolvedJxml);
        log.debug("mistral-vibe generating spec from JXML: {} chars",
                resolvedJxml == null ? 0 : resolvedJxml.length());
        return call("generateSpecFromJxml", prompt, () -> jxmlSpecFallback(resolvedJxml));
    }

    @Override
    public String generateSpecFromWord(String wordText) {
        Prompt prompt = buildWordSpecPrompt(wordText);
        log.debug("mistral-vibe generating spec from Word: {} chars", wordText == null ? 0 : wordText.length());
        return call("generateSpecFromWord", prompt, () -> wordSpecFallback(wordText));
    }

    @Override
    public String mergeSpecs(String wordMarkdown, String jxmlMarkdown) {
        Prompt prompt = buildMergeSpecsPrompt(wordMarkdown, jxmlMarkdown);
        log.debug("mistral-vibe merging specs: word={} chars, jxml={} chars",
                wordMarkdown == null ? 0 : wordMarkdown.length(),
                jxmlMarkdown == null ? 0 : jxmlMarkdown.length());
        return call("mergeSpecs", prompt, () -> mergeSpecsFallback(wordMarkdown, jxmlMarkdown));
    }

    /** Shared call/fallback path for the three prompt methods above: same retry-free error
     * handling and elapsed-time logging, only the prompt and the fallback message differ. */
    private String call(String operation, Prompt prompt, Supplier<String> fallback) {
        long start = System.currentTimeMillis();
        try {
            ChatResponse response = chatModel.call(prompt);
            long elapsedMs = System.currentTimeMillis() - start;
            log.info("mistral-vibe {} took {} ms", operation, elapsedMs);
            String content = response.getResult() != null ? response.getResult().getOutput().getText() : null;
            return content != null && !content.isBlank() ? escapeUnescapedPipesInTableCodeSpans(content) : fallback.get();
        } catch (Exception e) {
            long elapsedMs = System.currentTimeMillis() - start;
            log.error("mistral-vibe {} failed after {} ms (api-key \"{}\"): {}",
                    operation, elapsedMs, maskedApiKey(), e.getMessage(), e);
            return fallback.get();
        }
    }

    /** See {@link #CODE_SPAN}. Package-private for direct unit testing. */
    static String escapeUnescapedPipesInTableCodeSpans(String markdown) {
        StringBuilder result = new StringBuilder(markdown.length());
        String[] lines = markdown.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            result.append(isTableRow(line) ? escapePipesInCodeSpans(line) : line);
            if (i < lines.length - 1) {
                result.append('\n');
            }
        }
        return result.toString();
    }

    private static boolean isTableRow(String line) {
        String trimmed = line.strip();
        return trimmed.length() > 1 && trimmed.startsWith("|") && trimmed.endsWith("|");
    }

    private static String escapePipesInCodeSpans(String line) {
        Matcher matcher = CODE_SPAN.matcher(line);
        StringBuilder sb = new StringBuilder();
        int last = 0;
        while (matcher.find()) {
            sb.append(line, last, matcher.start());
            // Unescape first so an already-correctly-escaped `\|` isn't turned into `\\|`.
            sb.append(matcher.group().replace("\\|", "|").replace("|", "\\|"));
            last = matcher.end();
        }
        sb.append(line.substring(last));
        return sb.toString();
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
                identifie-le par son libellé résolu comme l'exige le gabarit.
                Les appels trans(...) encore présents dans ce JXML référencent des clés de traduction pour
                lesquelles aucune correspondance n'a été trouvée dans les fichiers de traduction sélectionnés
                (voir #285) : laisse-les tels quels plutôt que de deviner leur contenu — y compris comme
                identifiant quand le libellé d'un champ n'est qu'un appel trans(...) non résolu.
                La section « 5. Méta-données échangées » ne se déduit pas du JXML (voir le gabarit) : laisse-la
                avec « _Non renseigné dans la source._ » plutôt que d'y inventer des lignes à partir des champs
                du formulaire.
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

    Prompt buildMergeSpecsPrompt(String wordMarkdown, String jxmlMarkdown) {
        String safeWord = wordMarkdown == null ? "" : wordMarkdown;
        String safeJxml = jxmlMarkdown == null ? "" : jxmlMarkdown;
        String system = """
                %s

                Ces deux documents ont été générés indépendamment à partir du même gabarit ci-dessus
                (l'un depuis la spec Word/Excel, l'autre depuis le JXML) et documentent la même démarche.
                Fusionne-les en un seul document markdown final, en suivant IMPÉRATIVEMENT ce même
                gabarit dans son intégralité et dans le même ordre — ne saute aucune section.

                Règles d'arbitrage quand les deux sources se recoupent ou divergent :
                - Section 4 (découpage par section et par écran, y compris les bornes de chaque écran,
                  l'ordre des sections/écrans et la colonne `ID`) : privilégie la structure et le
                  découpage du JXML — c'est le code source qui reflète le plus fidèlement le
                  fonctionnement réel de l'application, le Word peut regrouper ou découper les écrans
                  différemment. Utilise le JXML comme squelette de cette section, et viens y rattacher
                  le contenu correspondant du Word (libellés métier, aides, règles de gestion) sur
                  l'écran JXML dont il se rapproche le plus.
                - Sous-section « Pièces jointes » et section 5 (Méta-données échangées) : à l'inverse,
                  ces informations ne se déduisent pas du JXML (voir le gabarit) — proviens-les
                  exclusivement du document Word, telles quelles.
                - Pour tout le reste (libellés, valeurs, conditions, règles de gestion, appels de
                  service) : combine les deux sources sans perdre d'information — si l'une des deux
                  documente un élément que l'autre a laissé à `_Non renseigné dans la source._` ou
                  absent, reprends la version renseignée. Si les deux sources renseignent la même
                  information de façon cohérente, ne la duplique pas. Si elles se contredisent
                  réellement sur un même élément (pas juste une absence d'un côté), retiens la version
                  la plus probable et signale le désaccord entre parenthèses juste après la valeur
                  retenue, en citant brièvement l'autre source (ex. « (Word indique <autre valeur>) »).
                - Ne laisse `_Non renseigné dans la source._` que lorsque NI le Word NI le JXML ne
                  renseignent l'information — les deux entrées couvrent ensemble davantage que chacune
                  séparément.
                """.formatted(DOCUMENTATION_TEMPLATE);
        String user = "Document généré depuis le Word/Excel :\n%s\n\nDocument généré depuis le JXML :\n%s"
                .formatted(safeWord, safeJxml);
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

    private String mergeSpecsFallback(String wordMarkdown, String jxmlMarkdown) {
        return "⚠️ Fusion IA indisponible — à fusionner manuellement.\n\n"
                + "## Document Word/Excel\n\n" + (wordMarkdown == null ? "(absent)" : wordMarkdown)
                + "\n\n## Document JXML\n\n" + (jxmlMarkdown == null ? "(absent)" : jxmlMarkdown);
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

}
