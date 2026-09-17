package com.specmerger.service.gitlab;

import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.parsers.DocumentBuilderFactory;
import lombok.extern.slf4j.Slf4j;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Resolves {@code trans(key)} calls found in JXML content into literal text, using the
 * project's own translation resources: {@code .properties} files (fixed names {@code de}/
 * {@code en}/{@code fr}, one language per file) and {@code .xlf} (XLIFF) files, both selected
 * and downloaded alongside the JXML sources by {@link GitLabSourceService} (see #266/#283).
 * The JXML format only exposes these keys, never the literal text (see #285) — without this
 * step, neither the model nor {@code DiffEngine} ever sees what a screen actually displays.
 *
 * <p>Only the configured resolution language (see {@code gitlab.translation-language}) is
 * extracted from the available resources; a key with no matching translation is left as the
 * original {@code trans(...)} call rather than guessed, same as an unresolved {@code <Include>}
 * (see {@link JxmlIncludeResolver}) — {@link #findUnresolvedKeys} lets the caller surface those
 * as warnings instead of leaving them buried in the content.
 */
@Slf4j
public final class TranslationResolver {

    // Keys are whatever the .properties/.xlf source declares them as (see Properties/XLIFF
    // parsing below) — punctuation like a trailing '?' is legal there, so this only excludes
    // quotes/parens rather than whitelisting "word" characters.
    private static final Pattern TRANS_CALL = Pattern.compile("trans\\(\\s*['\"]?([^'\"()]+?)['\"]?\\s*\\)");

    // e.g. "include_address_Part_BP_de" -> "de"; deliberately requires the leading underscore
    // so a bare "de.xlf"/"fr.xlf" (matched by matchesLanguageByFileName instead) isn't affected.
    private static final Pattern XLIFF_FILENAME_LANGUAGE_SUFFIX = Pattern.compile("_([a-zA-Z]{2})$");

    private TranslationResolver() {
    }

    public static boolean isTranslationFile(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        return lower.endsWith(".properties") || lower.endsWith(".xlf");
    }

    /**
     * Builds the key → text map for {@code language}, merging every translation file found in
     * {@code filesByPath} (non-translation files, e.g. the JXML sources themselves, are
     * ignored). The first file to define a given key wins; a later duplicate is logged and
     * skipped rather than silently overriding it, since two translation files disagreeing on
     * the same key means the selection is ambiguous, not that one should win arbitrarily.
     */
    public static Map<String, String> buildTranslations(Map<String, String> filesByPath, String language) {
        Map<String, String> translations = new LinkedHashMap<>();
        if (language == null || language.isBlank()) {
            return translations;
        }
        for (Map.Entry<String, String> entry : filesByPath.entrySet()) {
            String path = entry.getKey();
            String lower = path.toLowerCase(Locale.ROOT);
            Map<String, String> parsed;
            if (lower.endsWith(".properties")) {
                parsed = matchesLanguageByFileName(path, language) ? parseProperties(path, entry.getValue()) : Map.of();
            } else if (lower.endsWith(".xlf")) {
                parsed = parseXliff(path, entry.getValue(), language);
            } else {
                continue;
            }
            mergeWithoutOverriding(translations, parsed, path);
        }
        return translations;
    }

    /** Replaces every resolvable {@code trans(key)} call in {@code content}; a key absent from
     * {@code translations} is left untouched. */
    public static String resolve(String content, Map<String, String> translations) {
        if (content == null || content.isEmpty() || translations.isEmpty()) {
            return content == null ? "" : content;
        }
        Matcher matcher = TRANS_CALL.matcher(content);
        StringBuilder result = new StringBuilder();
        int lastEnd = 0;
        while (matcher.find()) {
            result.append(content, lastEnd, matcher.start());
            String resolved = translations.get(matcher.group(1));
            result.append(resolved != null ? resolved : matcher.group());
            lastEnd = matcher.end();
        }
        result.append(content, lastEnd, content.length());
        return result.toString();
    }

    /** Keys still left as {@code trans(...)} after {@link #resolve} — no translation matched
     * them in the selected resources/language, worth surfacing to the user rather than left
     * unnoticed in the generated content. */
    public static List<String> findUnresolvedKeys(String content) {
        List<String> keys = new ArrayList<>();
        if (content == null) {
            return keys;
        }
        Set<String> seen = new LinkedHashSet<>();
        Matcher matcher = TRANS_CALL.matcher(content);
        while (matcher.find()) {
            if (seen.add(matcher.group(1))) {
                keys.add(matcher.group(1));
            }
        }
        return keys;
    }

    private static void mergeWithoutOverriding(Map<String, String> translations, Map<String, String> parsed, String path) {
        for (Map.Entry<String, String> e : parsed.entrySet()) {
            String existing = translations.putIfAbsent(e.getKey(), e.getValue());
            if (existing != null && !existing.equals(e.getValue())) {
                log.warn("Traduction: clé '{}' définie différemment dans plusieurs fichiers sélectionnés "
                        + "(dont '{}') — la première valeur rencontrée est conservée.", e.getKey(), path);
            }
        }
    }

    /** Fixed-name convention (#266/#285): the file itself is named after the language it
     * carries, e.g. {@code fr.properties}. */
    private static boolean matchesLanguageByFileName(String path, String language) {
        return fileNameWithoutExtension(path).equalsIgnoreCase(language);
    }

    private static Map<String, String> parseProperties(String path, String content) {
        Properties props = new Properties();
        try {
            props.load(new StringReader(content));
        } catch (IOException e) {
            log.warn("Traduction: échec du parsing de '{}' (.properties) : {}", path, e.getMessage());
            return Map.of();
        }
        Map<String, String> result = new LinkedHashMap<>();
        for (String key : props.stringPropertyNames()) {
            result.put(key, props.getProperty(key));
        }
        return result;
    }

    /**
     * XLIFF 1.2 {@code <trans-unit id="...">} with {@code <source>}/{@code <target>} children.
     * Language selection: when the file name itself carries a {@code _xx} language suffix (e.g.
     * {@code include_address_Part_BP_de.xlf}), that name wins outright and the file is skipped
     * entirely if it doesn't match {@code language} — several such per-component files can
     * declare the very same {@code target-language} attribute while genuinely disagreeing on a
     * given key's text (independently translated from different source languages), which
     * otherwise floods the logs with spurious "defined differently" warnings for keys that were
     * never meant to be merged together in the first place. Absent such a suffix, the enclosing
     * {@code <file>}'s {@code target-language}/{@code source-language} attributes are used when
     * present (taking {@code <target>} text for the former, {@code <source>} for the latter);
     * when neither is declared, falls back to the same fixed-file-name convention as {@code
     * .properties} (e.g. {@code fr.xlf}), preferring each unit's {@code <target>} over its
     * {@code <source>} if both exist.
     */
    private static Map<String, String> parseXliff(String path, String content, String language) {
        String fileNameLanguage = xliffFileNameLanguageSuffix(path);
        if (fileNameLanguage != null && !fileNameLanguage.equalsIgnoreCase(language)) {
            return Map.of();
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            org.w3c.dom.Document doc = factory.newDocumentBuilder().parse(new InputSource(new StringReader(content)));

            Map<String, String> result = new LinkedHashMap<>();
            NodeList files = doc.getElementsByTagName("file");
            for (int i = 0; i < files.getLength(); i++) {
                Element file = (Element) files.item(i);
                Boolean useTarget = whichSideMatches(file, language, path);
                if (useTarget == null) {
                    continue;
                }
                NodeList units = file.getElementsByTagName("trans-unit");
                for (int u = 0; u < units.getLength(); u++) {
                    Element unit = (Element) units.item(u);
                    String id = unit.getAttribute("id");
                    if (id.isBlank()) {
                        continue;
                    }
                    String text = useTarget ? childText(unit, "target") : childText(unit, "source");
                    if (text == null && useTarget) {
                        text = childText(unit, "source");
                    }
                    if (text != null) {
                        result.put(id, text);
                    }
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Traduction: échec du parsing de '{}' (.xlf) : {}", path, e.getMessage());
            return Map.of();
        }
    }

    /** @return {@code true} to read each unit's {@code <target>}, {@code false} to read its
     * {@code <source>}, or {@code null} when this {@code <file>} carries no translation for
     * {@code language} at all. */
    private static Boolean whichSideMatches(Element file, String language, String path) {
        String targetLanguage = file.getAttribute("target-language");
        String sourceLanguage = file.getAttribute("source-language");
        if (!targetLanguage.isBlank() || !sourceLanguage.isBlank()) {
            if (languageMatches(targetLanguage, language)) {
                return true;
            }
            if (languageMatches(sourceLanguage, language)) {
                return false;
            }
            return null;
        }
        return matchesLanguageByFileName(path, language) ? true : null;
    }

    private static boolean languageMatches(String declared, String language) {
        if (declared == null || declared.isBlank()) {
            return false;
        }
        // XLIFF language codes may carry a region (e.g. "fr-FR") — compare on the primary
        // subtag only, same granularity as the .properties fixed-name convention.
        String primary = declared.split("[-_]")[0];
        return primary.equalsIgnoreCase(language);
    }

    private static String childText(Element parent, String tagName) {
        NodeList children = parent.getElementsByTagName(tagName);
        if (children.getLength() == 0) {
            return null;
        }
        Node node = children.item(0);
        String text = node.getTextContent();
        return text == null || text.isBlank() ? null : text;
    }

    private static String xliffFileNameLanguageSuffix(String path) {
        Matcher matcher = XLIFF_FILENAME_LANGUAGE_SUFFIX.matcher(fileNameWithoutExtension(path));
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String fileNameWithoutExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
