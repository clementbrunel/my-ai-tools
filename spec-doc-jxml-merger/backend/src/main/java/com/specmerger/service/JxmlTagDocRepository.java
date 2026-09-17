package com.specmerger.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Indexes the JWAY tag/control/function reference markdown shipped under
 * classpath:jxml-tags/ (see issue #262) and finds which ones are relevant to
 * a given JXML excerpt, so they can be injected as context for the AI
 * resolver instead of asking it to interpret unfamiliar JWAY syntax blind.
 */
@Slf4j
@Component
public class JxmlTagDocRepository {

    // Deliberately permissive on what follows the name (empty "()", a parameter such as
    // "(date)"/"($(date))", or trailing bold markup like "**roundHalfEven()**") so it catches
    // every heading spelling used across the corpus — including DateFunctions.md's paired
    // "getYear(date)" / "getYear()" headings for the same function — without missing any when
    // used as section boundaries in {@link #splitByFunction}.
    private static final Pattern FUNCTION_HEADING =
            Pattern.compile("(?i)fonction\\s+\\**([A-Za-z_][A-Za-z0-9_]*)\\**\\s*\\(");

    private static final Pattern HEADING_LINE = Pattern.compile("(?m)^(#{1,6})\\s+.*$");

    // The fiches are lifted as-is from JWAY Campus, XML example and page-source footer
    // included — useful to a human reader, but they roughly account for a third of the
    // corpus' size for no benefit to the model (it works from the caller's real JXML, not
    // from a canned example). Stripped here at load time rather than by hand-editing the
    // 76 .md files, so there's still a single source of truth for them.
    private static final Pattern XML_EXAMPLE_BLOCK = Pattern.compile("(?s)```(?:xml|java)\\n.*?```\\n?");
    private static final Pattern SOURCE_FOOTER =
            Pattern.compile("(?m)^Source\\s*:\\s*documentation JWAY Campus.*$\\n?");
    // Once XML_EXAMPLE_BLOCK strips a fenced example, the heading that introduced it (e.g.
    // "## Exemple de code JXML") is left dangling with nothing under it — still visible in the
    // prompt even though the example itself is gone. Matches any heading immediately followed
    // (blank lines aside) by another heading or the end of the doc, i.e. one with no remaining
    // content of its own, regardless of its wording. Non-heading lead-ins (a bold, colon-
    // terminated sentence/label instead of a "#" heading) aren't matched here on purpose —
    // rather than widen this regex for that rarer shape, the one fiche that used to have them
    // (AppelREST.md) was edited directly to drop them.
    private static final Pattern DANGLING_HEADING =
            Pattern.compile("(?m)^#{1,6}[^\\n]*\\n\\s*(?=#{1,6}[^\\n]*\\n|\\z)");

    // Extra trigger patterns that don't fit the generic <Tag>/Type="..."/Fonction x()
    // conventions, keyed by doc id (filename without extension). AppelREST also covers
    // callExtension(), which is invoked from a Java class "extends FormPublisherExtension"
    // rather than from a JXML tag — so a matching class in the excerpt is relevant too.
    private static final Map<String, List<Pattern>> EXTRA_PATTERNS = Map.of(
            "AppelREST", List.of(Pattern.compile("extends\\s+FormPublisherExtension"))
    );

    private final List<Doc> docs = new ArrayList<>();

    public JxmlTagDocRepository() {
        this("classpath*:jxml-tags/**/*.md");
    }

    JxmlTagDocRepository(String locationPattern) {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            for (Resource resource : resolver.getResources(locationPattern)) {
                String id = stripExtension(resource.getFilename());
                String rawContent = readContent(resource);
                String compacted = compactForPrompt(rawContent);
                FunctionSplit split = splitByFunction(compacted);
                docs.add(new Doc(id, compacted, split.preamble(), split.sections(), buildPatterns(id, rawContent)));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger les fiches jxml-tags/", e);
        }
    }

    /**
     * Returns the content of the docs whose tag, Control Type or function name is
     * detected in the excerpt, already stripped of their XML examples and source
     * footer (see {@link #compactForPrompt}) and ordered by how often they're matched
     * in the excerpt (most-used tag first), capped so the combined size stays
     * reasonable in a prompt. A doc covering several functions (TextFunctions.md,
     * DateFunctions.md, …) only contributes its intro plus the sections of the specific
     * functions actually called in the excerpt (see {@link #splitByFunction}), rather
     * than every function it documents. If relevant docs still had to be left out to
     * stay under the cap, logs a warning naming them — a recurring warning here means
     * jxml-tags/ itself needs trimming further, not just a higher cap.
     */
    public List<String> findRelevantDocs(String jxmlExcerpt, int maxDocs, int maxTotalChars) {
        if (jxmlExcerpt == null || jxmlExcerpt.isBlank()) {
            return List.of();
        }
        List<Doc> matched = new ArrayList<>();
        for (Doc doc : docs) {
            if (doc.matches(jxmlExcerpt)) {
                matched.add(doc);
            }
        }
        // Prioritize docs whose tag/Control Type/function occurs most often in the excerpt,
        // so a heavily-used tag doesn't lose its spot to one mentioned once just because it
        // sorts earlier on the classpath.
        matched.sort(Comparator.<Doc>comparingInt(doc -> doc.occurrences(jxmlExcerpt)).reversed());

        List<String> selected = new ArrayList<>();
        List<String> dropped = new ArrayList<>();
        boolean droppedForDocCountCap = false;
        boolean droppedForCharBudgetCap = false;
        int totalChars = 0;
        for (Doc doc : matched) {
            String docContent = doc.contentFor(jxmlExcerpt);
            boolean docCountCapReached = selected.size() >= maxDocs;
            boolean charBudgetCapReached = totalChars + docContent.length() > maxTotalChars;
            if (!docCountCapReached && !charBudgetCapReached) {
                selected.add(docContent);
                totalChars += docContent.length();
            } else {
                dropped.add(doc.id);
                droppedForDocCountCap |= docCountCapReached;
                droppedForCharBudgetCap |= charBudgetCapReached;
            }
        }

        if (!dropped.isEmpty()) {
            String limitingFactor = droppedForDocCountCap && droppedForCharBudgetCap
                    ? "nombre de fiches ET caractères"
                    : droppedForDocCountCap ? "nombre de fiches (cap de " + maxDocs + " atteint)"
                    : "caractères (cap de " + maxTotalChars + " atteint)";
            log.warn("jxml-tags: {} fiche(s) pertinente(s) non incluses dans le prompt Mistral faute de place "
                            + "(cap actuel : {} fiches / {} caractères ; facteur limitant : {}) : {}. Si ce warning "
                            + "revient souvent, il faudra alléger ces fiches (retirer les exemples de code par ex.) "
                            + "ou revoir la sélection plutôt que d'augmenter indéfiniment la limite.",
                    dropped.size(), maxDocs, maxTotalChars, limitingFactor, dropped);
        }

        return selected;
    }

    private static List<Pattern> buildPatterns(String id, String content) {
        List<Pattern> patterns = new ArrayList<>();
        // element / input tag, e.g. <Content ...> or <TextBox .../>
        patterns.add(Pattern.compile("<" + Pattern.quote(id) + "\\b"));
        // Control Type value, e.g. Type="IBAN" — split on '_' for combined docs
        // such as lessThan_greaterThan.md, which cover two Control types each.
        for (String part : id.split("_")) {
            patterns.add(Pattern.compile("(?i)Type\\s*=\\s*[\"']" + Pattern.quote(part) + "[\"']"));
        }
        // function call, extracted from "## Fonction xxx()" headings
        Matcher m = FUNCTION_HEADING.matcher(content);
        Set<String> functionNames = new LinkedHashSet<>();
        while (m.find()) {
            functionNames.add(m.group(1));
        }
        for (String fn : functionNames) {
            patterns.add(Pattern.compile("\\b" + Pattern.quote(fn) + "\\s*\\("));
        }
        patterns.addAll(EXTRA_PATTERNS.getOrDefault(id, List.of()));
        return patterns;
    }

    // Package-private rather than private so JxmlTagDocRepositoryTest can exercise each
    // cleaning step directly with crafted snippets, instead of only indirectly through the
    // real jxml-tags/ fiches via findRelevantDocs.
    static String compactForPrompt(String content) {
        String withoutExamples = XML_EXAMPLE_BLOCK.matcher(content).replaceAll("");
        String withoutFooter = SOURCE_FOOTER.matcher(withoutExamples).replaceAll("");
        String withoutDanglingHeadings = DANGLING_HEADING.matcher(withoutFooter).replaceAll("");
        return withoutDanglingHeadings.replaceAll("\\n{3,}", "\n\n").strip();
    }

    /**
     * Splits an already-compacted doc into an always-kept preamble (everything before its
     * first function heading — title, intro, the "## Liste des fonctions disponibles" summary
     * when present) plus one {@link FunctionSection} per "## Fonction xxx(...)"-style heading,
     * each bounded by the next heading of equal or higher level. Applied only when a doc
     * documents at least two distinct functions (TextFunctions.md, DateFunctions.md, …): such
     * "mega-fiches" otherwise dominate the prompt's char budget even though a given JXML
     * excerpt typically calls only one or two of the many functions they cover. A doc with
     * zero or one function heading (an element/control doc, or one whose match trigger is
     * really its own tag rather than a single function, e.g. AppelREST.md) is returned with no
     * sections, so its plain content is kept untouched — see {@link Doc#contentFor}.
     */
    private static FunctionSplit splitByFunction(String compactedContent) {
        record Heading(int start, int level, String text) {
        }
        List<Heading> headings = new ArrayList<>();
        Matcher hm = HEADING_LINE.matcher(compactedContent);
        while (hm.find()) {
            headings.add(new Heading(hm.start(), hm.group(1).length(), hm.group()));
        }

        List<FunctionSection> sections = new ArrayList<>();
        int firstSectionStart = -1;
        for (int i = 0; i < headings.size(); i++) {
            Heading heading = headings.get(i);
            Matcher fm = FUNCTION_HEADING.matcher(heading.text());
            if (!fm.find()) {
                continue;
            }
            if (firstSectionStart < 0) {
                firstSectionStart = heading.start();
            }
            int end = compactedContent.length();
            for (int j = i + 1; j < headings.size(); j++) {
                if (headings.get(j).level() <= heading.level()) {
                    end = headings.get(j).start();
                    break;
                }
            }
            String name = fm.group(1);
            String text = compactedContent.substring(heading.start(), end).strip();
            sections.add(new FunctionSection(name, Pattern.compile("\\b" + Pattern.quote(name) + "\\s*\\("), text));
        }

        long distinctFunctions = sections.stream().map(FunctionSection::name).distinct().count();
        if (distinctFunctions < 2) {
            return new FunctionSplit("", List.of());
        }
        return new FunctionSplit(compactedContent.substring(0, firstSectionStart).strip(), sections);
    }

    private record FunctionSplit(String preamble, List<FunctionSection> sections) {
    }

    private record FunctionSection(String name, Pattern callPattern, String text) {
    }

    private static String stripExtension(String filename) {
        if (filename == null) {
            return "unknown";
        }
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private static String readContent(Resource resource) throws IOException {
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private record Doc(String id, String content, String preamble, List<FunctionSection> sections,
                        List<Pattern> patterns) {
        boolean matches(String excerpt) {
            for (Pattern p : patterns) {
                if (p.matcher(excerpt).find()) {
                    return true;
                }
            }
            return false;
        }

        int occurrences(String excerpt) {
            int count = 0;
            for (Pattern p : patterns) {
                Matcher m = p.matcher(excerpt);
                while (m.find()) {
                    count++;
                }
            }
            return count;
        }

        /**
         * The doc content to actually inject for this excerpt: the full content as-is for a
         * doc that wasn't split (no {@link #sections}), otherwise the preamble plus only the
         * sections of the functions this excerpt actually calls. Falls back to the full content
         * if none of the excerpt's calls line up with a named section — e.g. a split doc matched
         * through some other pattern than a function call — so a real match is never dropped.
         */
        String contentFor(String excerpt) {
            if (sections.isEmpty()) {
                return content;
            }
            StringBuilder sb = new StringBuilder(preamble);
            for (FunctionSection section : sections) {
                if (section.callPattern().matcher(excerpt).find()) {
                    sb.append("\n\n").append(section.text());
                }
            }
            return sb.length() > preamble.length() ? sb.toString().strip() : content;
        }
    }
}
