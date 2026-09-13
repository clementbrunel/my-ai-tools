package com.specmerger.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Extracts raw text from the Word specification. Splitting into logical sections
 * (screens, features...) is not implemented yet — see SPEC.md "Découpage des specs".
 */
@Component
public class WordSpecParser {

    public String extractText(InputStream docxStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(docxStream)) {
            List<XWPFParagraph> paragraphs = document.getParagraphs();
            return paragraphs.stream()
                    .map(XWPFParagraph::getText)
                    .filter(text -> !text.isBlank())
                    .collect(Collectors.joining("\n"));
        }
    }
}
