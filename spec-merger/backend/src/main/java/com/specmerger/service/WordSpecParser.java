package com.specmerger.service;

import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.poifs.filesystem.FileMagic;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Extracts raw text from the Word specification, in either the modern OOXML (.docx) or the
 * legacy OLE2 (.doc) format. Which one it is gets detected from the file's own content (magic
 * bytes) rather than trusted from its name/extension, since the two need different POI readers.
 * Splitting the extracted text into logical sections (screens, features...) is not implemented
 * yet — see issues #260 and #261.
 */
@Component
public class WordSpecParser {

    public String extractText(InputStream wordStream) throws IOException {
        InputStream prepared = FileMagic.prepareToCheckMagic(wordStream);
        FileMagic magic = FileMagic.valueOf(prepared);
        return switch (magic) {
            case OOXML -> extractFromDocx(prepared);
            case OLE2 -> extractFromDoc(prepared);
            default -> throw new IllegalArgumentException(
                    "Format de fichier non reconnu : seuls les fichiers .doc et .docx sont acceptés.");
        };
    }

    private String extractFromDocx(InputStream docxStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(docxStream)) {
            List<XWPFParagraph> paragraphs = document.getParagraphs();
            return paragraphs.stream()
                    .map(XWPFParagraph::getText)
                    .filter(text -> !text.isBlank())
                    .collect(Collectors.joining("\n"));
        }
    }

    private String extractFromDoc(InputStream docStream) throws IOException {
        try (WordExtractor extractor = new WordExtractor(docStream)) {
            return Arrays.stream(extractor.getParagraphText())
                    .map(String::trim)
                    .filter(text -> !text.isBlank())
                    .collect(Collectors.joining("\n"));
        }
    }
}
