package com.specmerger.service.gitlab;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts the list of démarche entry points from a JWAY FORMS.jxml menu file — every
 * {@code <Hyperlink Type="Document" DocumentId="...">} it declares, in document order.
 * FORMS.jxml ({@code <JForm documentId="FORMS">}) is always a menu for the whole EAR, never
 * itself a démarche to document (see issue #262): its own Sections are never fed to the
 * model, only used here to discover which démarches the user can choose to document. One
 * EAR can serve several démarches (several Hyperlinks, sometimes in the very same Section),
 * so this only lists the candidates — picking exactly one is left to the caller.
 * Uses regex rather than a DOM parser: like {@link JxmlIncludeResolver}, real FORMS.jxml
 * content isn't guaranteed to be well-formed XML (unescaped operators in Condition/Expression
 * attributes, etc.), so a strict parse would silently drop every entry point on a file a DOM
 * parser rejects.
 */
public final class FormsEntryPointParser {

    private static final Pattern HYPERLINK_TAG = Pattern.compile("<Hyperlink\\b[^>]*>");
    private static final Pattern TYPE_ATTR = Pattern.compile("\\bType\\s*=\\s*[\"']([^\"']*)[\"']");
    private static final Pattern DOCUMENT_ID_ATTR = Pattern.compile("\\bDocumentId\\s*=\\s*[\"']([^\"']*)[\"']");

    private FormsEntryPointParser() {
    }

    public static List<String> extractDocumentIds(String formsJxml) {
        if (formsJxml == null || formsJxml.isBlank()) {
            return List.of();
        }

        Set<String> documentIds = new LinkedHashSet<>();
        Matcher hyperlinks = HYPERLINK_TAG.matcher(formsJxml);
        while (hyperlinks.find()) {
            String tag = hyperlinks.group();
            Matcher type = TYPE_ATTR.matcher(tag);
            if (!type.find() || !"Document".equals(type.group(1))) {
                continue;
            }
            Matcher documentId = DOCUMENT_ID_ATTR.matcher(tag);
            if (documentId.find() && !documentId.group(1).isBlank()) {
                documentIds.add(documentId.group(1));
            }
        }
        return new ArrayList<>(documentIds);
    }
}
