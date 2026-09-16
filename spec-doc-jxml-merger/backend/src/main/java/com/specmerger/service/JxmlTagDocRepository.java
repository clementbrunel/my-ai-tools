package com.specmerger.service;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
@Component
public class JxmlTagDocRepository {

    private static final Pattern FUNCTION_HEADING =
            Pattern.compile("(?i)fonction\\s+\\**([A-Za-z_][A-Za-z0-9_]*)\\(\\)");

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
                String content = readContent(resource);
                docs.add(new Doc(id, content, buildPatterns(id, content)));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger les fiches jxml-tags/", e);
        }
    }

    /**
     * Returns the content of the docs whose tag, Control Type or function name is
     * detected in the excerpt, capped so the combined size stays reasonable in a prompt.
     */
    public List<String> findRelevantDocs(String jxmlExcerpt, int maxDocs, int maxTotalChars) {
        if (jxmlExcerpt == null || jxmlExcerpt.isBlank()) {
            return List.of();
        }
        List<String> matches = new ArrayList<>();
        int totalChars = 0;
        for (Doc doc : docs) {
            if (matches.size() >= maxDocs || totalChars >= maxTotalChars) {
                break;
            }
            if (doc.matches(jxmlExcerpt)) {
                matches.add(doc.content);
                totalChars += doc.content.length();
            }
        }
        return matches;
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

    private record Doc(String id, String content, List<Pattern> patterns) {
        boolean matches(String excerpt) {
            for (Pattern p : patterns) {
                if (p.matcher(excerpt).find()) {
                    return true;
                }
            }
            return false;
        }
    }
}
