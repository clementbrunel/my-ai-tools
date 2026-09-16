package com.specmerger.service.gitlab;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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

    private static final Pattern INCLUDE_TAG =
            Pattern.compile("<Include\\b[^>]*?DocumentId\\s*=\\s*[\"']([^\"']+)[\"'][^>]*?/>");

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
