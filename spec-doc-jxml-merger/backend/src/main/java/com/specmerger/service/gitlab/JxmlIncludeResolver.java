package com.specmerger.service.gitlab;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Flattens {@code <Include DocumentId="..."/>} fragments into a single JXML document,
 * following the same {@code DocumentId} → {@code "<DocumentId>.jxml"} convention as
 * FORMS.jxml's Hyperlinks (see {@link FormsEntryPointParser}) — the model shouldn't have to
 * mentally stitch several separate files back together (see issue #262). A missing target
 * or a circular Include chain leaves the tag in place, wrapped in a comment explaining why,
 * rather than failing the whole preview.
 */
public final class JxmlIncludeResolver {

    /** Matches both the self-closing {@code <Include .../>} form and the open/close
     * {@code <Include ...>...</Include>} form some JWAY sources use instead — real projects
     * mix both, and a tag this misses is silently left as-is with nothing to substitute it
     * and no warning, since {@link #findWarnings} only inspects what {@link #resolve} produced. */
    private static final Pattern INCLUDE_TAG =
            Pattern.compile(
                    "<Include\\b[^>]*?DocumentId\\s*=\\s*[\"']([^\"']+)[\"'][^>]*?(?:/>|>.*?</Include\\s*>)",
                    Pattern.DOTALL);

    /** Any {@code <Include} still present after {@link #resolve} — should never happen once
     * {@link #INCLUDE_TAG} matched it, but catches an unexpected real-world Include shape
     * that slips past the regex above, so it's surfaced as a warning instead of silently
     * left unreplaced in the output (see the DocumentId-not-substituted report). */
    private static final Pattern LEFTOVER_INCLUDE_TAG = Pattern.compile("<Include\\b[^>]*>");

    private static final Pattern UNRESOLVED_INCLUDE_COMMENT =
            Pattern.compile("<!--\\s*Include non résolu\\s*:\\s*(.*?)\\s*-->");

    /** Opening, closing or self-closing tags — comments (which don't start with a letter) are
     * excluded naturally, same simplification as {@link #INCLUDE_TAG}. */
    private static final Pattern ANY_TAG =
            Pattern.compile("<(/?)([A-Za-z_][\\w.:-]*)\\b[^>]*?(/?)>");

    private JxmlIncludeResolver() {
    }

    /** Resolves {@code rootPath}'s content, recursively substituting its Include fragments. */
    public static String resolve(String rootPath, Map<String, String> filesByPath) {
        String rootContent = filesByPath.get(rootPath);
        if (rootContent == null) {
            return "";
        }
        Map<String, String> byDocumentId = indexByDocumentId(filesByPath);
        Set<String> visiting = new LinkedHashSet<>();
        visiting.add(fileNameWithoutExtension(rootPath));
        return resolve(rootContent, byDocumentId, visiting);
    }

    private static String resolve(String content, Map<String, String> byDocumentId, Set<String> visiting) {
        Matcher matcher = INCLUDE_TAG.matcher(content);
        StringBuilder result = new StringBuilder();
        int lastEnd = 0;
        while (matcher.find()) {
            result.append(content, lastEnd, matcher.start());
            String documentId = matcher.group(1);
            String included = byDocumentId.get(documentId);
            if (included == null) {
                result.append("<!-- Include non résolu : DocumentId=\"").append(documentId)
                        .append("\" (fichier introuvable) -->");
            } else if (visiting.contains(documentId)) {
                result.append("<!-- Include non résolu : DocumentId=\"").append(documentId)
                        .append("\" (cycle détecté) -->");
            } else {
                Set<String> nextVisiting = new LinkedHashSet<>(visiting);
                nextVisiting.add(documentId);
                result.append(resolve(included, byDocumentId, nextVisiting));
            }
            lastEnd = matcher.end();
        }
        result.append(content, lastEnd, content.length());
        return result.toString();
    }

    /**
     * Scans a resolved document for issues worth surfacing separately from the raw text
     * rather than left buried in the middle of it: unresolved/circular Includes (the
     * comments {@link #resolve} leaves behind) and mismatched or unclosed element nesting,
     * which naive string-substitution of Include fragments can produce when a fragment's own
     * tags don't balance. Best-effort like the rest of this class: attribute values
     * containing {@code >} aren't handled, matching {@link #INCLUDE_TAG}'s own simplification.
     */
    public static List<String> findWarnings(String resolvedContent) {
        List<String> warnings = new ArrayList<>();
        Matcher unresolved = UNRESOLVED_INCLUDE_COMMENT.matcher(resolvedContent);
        while (unresolved.find()) {
            warnings.add("Include non résolu : " + unresolved.group(1));
        }
        Matcher leftover = LEFTOVER_INCLUDE_TAG.matcher(resolvedContent);
        while (leftover.find()) {
            warnings.add("Balise <Include> non traitée (format inattendu, ni résolue ni signalée) : "
                    + leftover.group());
        }
        warnings.addAll(findNestingIssues(resolvedContent));
        return warnings;
    }

    private static List<String> findNestingIssues(String content) {
        List<String> issues = new ArrayList<>();
        Deque<String> openTags = new ArrayDeque<>();
        Matcher matcher = ANY_TAG.matcher(content);
        while (matcher.find()) {
            boolean isClosing = !matcher.group(1).isEmpty();
            boolean isSelfClosing = !matcher.group(3).isEmpty();
            String tagName = matcher.group(2);
            if (isSelfClosing) {
                continue;
            }
            if (!isClosing) {
                openTags.push(tagName);
                continue;
            }
            if (openTags.isEmpty()) {
                issues.add("Balise fermante </" + tagName + "> sans balise ouvrante correspondante — "
                        + "imbrication probablement incomplète.");
            } else if (openTags.peek().equals(tagName)) {
                openTags.pop();
            } else {
                issues.add("Imbrication incomplète : <" + openTags.peek() + "> n'est pas refermé avant </"
                        + tagName + ">.");
                openTags.pop();
            }
        }
        for (String stillOpen : openTags) {
            issues.add("Balise <" + stillOpen + "> jamais refermée.");
        }
        return issues;
    }

    private static Map<String, String> indexByDocumentId(Map<String, String> filesByPath) {
        Map<String, String> byDocumentId = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : filesByPath.entrySet()) {
            byDocumentId.put(fileNameWithoutExtension(entry.getKey()), entry.getValue());
        }
        return byDocumentId;
    }

    private static String fileNameWithoutExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
