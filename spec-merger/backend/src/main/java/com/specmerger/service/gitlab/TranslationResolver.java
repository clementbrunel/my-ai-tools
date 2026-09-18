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
 * {@code en}/{@code fr}, one language per file, shared project-wide) and {@code .xlf} (XLIFF)
 * files, both selected and downloaded alongside the JXML sources by {@link GitLabSourceService}
 * (see #266/#283). The JXML format only exposes these keys, never the literal text (see #285) —
 * without this step, the model never sees what a screen actually displays.
 *
 * <p>Unlike the project-wide {@code .properties} files, {@code .xlf} resources are published
 * per JXML document, following a fixed {@code <document>.jxml} → {@code <document>_<lang>.xlf}
 * naming convention (one file per language, e.g. {@code include_address_Part_BP_fr.xlf}/{@code
 * _en.xlf}/{@code _de.xlf}) — each document numbers its own keys independently, so {@code id="3"}
 * in one document's family means something else entirely in another's. {@link #resolveAll}
 * therefore resolves each document's own {@code trans(...)} calls against only its own {@code
 * .xlf} family (plus the project-wide {@code .properties}/fixed-name resources); merging every
 * selected {@code .xlf} into one global dictionary — as an earlier version of this class did —
 * made unrelated documents' identically-numbered keys collide and log spurious "defined
 * differently" warnings for keys that were never meant to be compared in the first place.
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

    // e.g. "include_address_Part_BP_de" -> scope "include_address_Part_BP"; a bare "de"/"fr"
    // (matched by matchesLanguageByFileName instead, e.g. a project-wide "en.xlf") has no
    // underscore before it and is deliberately left alone by this pattern.
    private static final Pattern XLIFF_SCOPED_FILENAME = Pattern.compile("^(.*)_[a-zA-Z]{2}$");

    private TranslationResolver() {
    }

    public static boolean isTranslationFile(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        return lower.endsWith(".properties") || lower.endsWith(".xlf");
    }

    /**
     * Resolves every non-translation file's own {@code trans(...)} calls, each against only the
     * translation resources that belong to it (see the class-level javadoc) — a document's own
     * {@code .xlf} family, identified by its file name, plus the project-wide {@code
     * .properties}/fixed-name resources. Translation files themselves are passed through
     * untouched, since they aren't JXML content to resolve.
     */
    public static Map<String, String> resolveAll(Map<String, String> filesByPath, String language) {
        Map<String, String> resolved = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : filesByPath.entrySet()) {
            String path = entry.getKey();
            if (isTranslationFile(path)) {
                resolved.put(path, entry.getValue());
                continue;
            }
            Map<String, String> translations = buildTranslations(filesByPath, fileNameWithoutExtension(path), language);
            resolved.put(path, resolve(entry.getValue(), translations));
        }
        return resolved;
    }

    /**
     * Builds the key → text map for {@code language} without any per-document scoping: every
     * matching {@code .properties}/{@code .xlf} file found in {@code filesByPath} is merged
     * together regardless of which JXML document it belongs to. Only safe to call directly when
     * the selected {@code .xlf} files are all project-wide (no {@code <document>_<lang>.xlf}
     * family among them) — {@link #resolveAll} is the document-aware entry point real callers
     * should use instead.
     */
    public static Map<String, String> buildTranslations(Map<String, String> filesByPath, String language) {
        return buildTranslations(filesByPath, null, language);
    }

    /**
     * Builds the key → text map for {@code language}, scoped to the JXML document named {@code
     * docBaseName} (its file name without extension): a project-wide {@code .properties} file or
     * fixed-name {@code .xlf} (e.g. {@code en.xlf}) always qualifies, while an {@code .xlf}
     * carrying a {@code <document>_<lang>} name only qualifies when its {@code <document>} prefix
     * matches {@code docBaseName} — see the class-level javadoc. Passing {@code null} for {@code
     * docBaseName} disables this filtering (every {@code .xlf} qualifies structurally), matching
     * {@link #buildTranslations(Map, String)}. The first file to define a given key wins; a later
     * duplicate is logged and skipped rather than silently overriding it, since two translation
     * files disagreeing on the same key means the selection is ambiguous, not that one should win
     * arbitrarily.
     */
    public static Map<String, String> buildTranslations(Map<String, String> filesByPath, String docBaseName, String language) {
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
                parsed = qualifiesForDocument(path, docBaseName) ? parseXliff(path, entry.getValue(), language) : Map.of();
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

    /** @see #buildTranslations(Map, String, String) */
    private static boolean qualifiesForDocument(String path, String docBaseName) {
        String scope = xliffScopedDocumentName(path);
        return scope == null || docBaseName == null || scope.equalsIgnoreCase(docBaseName);
    }

    /** @return the {@code <document>} prefix of a {@code <document>_<lang>.xlf} file name, or
     * {@code null} when the file carries no such per-document language suffix (e.g. the
     * project-wide fixed-name {@code en.xlf}). */
    private static String xliffScopedDocumentName(String path) {
        Matcher matcher = XLIFF_SCOPED_FILENAME.matcher(fileNameWithoutExtension(path));
        return matcher.matches() ? matcher.group(1) : null;
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
     * Language selection prefers each unit's own {@code <source xml:lang="...">}/{@code <target
     * xml:lang="...">} attribute when present — the most precise signal, and the one real JWAY
     * exports actually carry on {@code <source>} — falling back to the enclosing {@code
     * <file>}'s {@code target-language}/{@code source-language} attributes, and finally to the
     * same fixed-file-name convention as {@code .properties} (e.g. {@code fr.xlf}) when neither
     * is declared anywhere. Prefers each unit's {@code <target>} over its {@code <source>} when
     * the resolved side is the target but empty.
     */
    private static Map<String, String> parseXliff(String path, String content, String language) {
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
                String fileTargetLanguage = file.getAttribute("target-language");
                String fileSourceLanguage = file.getAttribute("source-language");
                NodeList units = file.getElementsByTagName("trans-unit");
                for (int u = 0; u < units.getLength(); u++) {
                    Element unit = (Element) units.item(u);
                    String id = unit.getAttribute("id");
                    if (id.isBlank()) {
                        continue;
                    }
                    Boolean useTarget = whichSideMatches(unit, fileTargetLanguage, fileSourceLanguage, language, path);
                    if (useTarget == null) {
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

    /** @return {@code true} to read this unit's {@code <target>}, {@code false} to read its
     * {@code <source>}, or {@code null} when nothing (unit, file or file name) declares a
     * translation for {@code language} at all. */
    private static Boolean whichSideMatches(Element unit, String fileTargetLanguage, String fileSourceLanguage,
            String language, String path) {
        String unitSourceLanguage = elementLang(unit, "source");
        String unitTargetLanguage = elementLang(unit, "target");
        if (unitSourceLanguage != null || unitTargetLanguage != null) {
            if (languageMatches(unitSourceLanguage, language)) {
                return false;
            }
            if (languageMatches(unitTargetLanguage, language)) {
                return true;
            }
        }
        if (!fileTargetLanguage.isBlank() || !fileSourceLanguage.isBlank()) {
            if (languageMatches(fileTargetLanguage, language)) {
                return true;
            }
            if (languageMatches(fileSourceLanguage, language)) {
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

    private static String elementLang(Element unit, String tagName) {
        NodeList children = unit.getElementsByTagName(tagName);
        if (children.getLength() == 0) {
            return null;
        }
        Element element = (Element) children.item(0);
        String lang = element.getAttribute("xml:lang");
        return lang.isBlank() ? null : lang;
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

    private static String fileNameWithoutExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
