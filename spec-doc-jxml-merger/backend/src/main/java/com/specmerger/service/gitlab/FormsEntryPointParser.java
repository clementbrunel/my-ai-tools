package com.specmerger.service.gitlab;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import lombok.extern.slf4j.Slf4j;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Extracts the list of démarche entry points from a JWAY FORMS.jxml menu file — every
 * {@code <Hyperlink Type="Document" DocumentId="...">} it declares, in document order.
 * FORMS.jxml ({@code <JForm documentId="FORMS">}) is always a menu for the whole EAR, never
 * itself a démarche to document (see issue #262): its own Sections are never fed to the
 * model, only used here to discover which démarches the user can choose to document. One
 * EAR can serve several démarches (several Hyperlinks, sometimes in the very same Section),
 * so this only lists the candidates — picking exactly one is left to the caller.
 */
@Slf4j
public final class FormsEntryPointParser {

    private FormsEntryPointParser() {
    }

    public static List<String> extractDocumentIds(String formsJxml) {
        Document doc;
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // FORMS.jxml comes from a GitLab repo we don't fully control the content of —
            // harden against XXE regardless.
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            doc = builder.parse(new ByteArrayInputStream(formsJxml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            log.warn("FORMS.jxml: échec du parsing XML, aucun point d'entrée détecté : {}", e.getMessage());
            return List.of();
        }

        Set<String> documentIds = new LinkedHashSet<>();
        NodeList hyperlinks = doc.getElementsByTagName("Hyperlink");
        for (int i = 0; i < hyperlinks.getLength(); i++) {
            if (!(hyperlinks.item(i) instanceof Element el)) {
                continue;
            }
            if (!"Document".equals(el.getAttribute("Type"))) {
                continue;
            }
            String documentId = el.getAttribute("DocumentId");
            if (!documentId.isBlank()) {
                documentIds.add(documentId);
            }
        }
        return new ArrayList<>(documentIds);
    }
}
