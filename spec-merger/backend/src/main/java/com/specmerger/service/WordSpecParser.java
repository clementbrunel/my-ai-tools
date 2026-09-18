package com.specmerger.service;

import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.poifs.filesystem.FileMagic;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ICell;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFSDT;
import org.apache.poi.xwpf.usermodel.XWPFSDTCell;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Extracts raw text from the Word specification, in either the modern OOXML (.docx) or the
 * legacy OLE2 (.doc) format. Which one it is gets detected from the file's own content (magic
 * bytes) rather than trusted from its name/extension, since the two need different POI readers.
 * Splitting the extracted text into logical sections (screens, features...) is not implemented
 * yet — see issues #260 and #261. {@link ExcelSpecParser} is the equivalent for specs written
 * as an Excel workbook instead (#267); the row-flattening plumbing the two share lives in
 * {@link SpecTextUtils}.
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

    /**
     * {@link XWPFDocument#getParagraphs()} only returns top-level body paragraphs — text inside
     * tables (e.g. the CTIE canevas' "Eléments" table) lives in a separate structure and is
     * silently dropped if read that way. Walking the body elements in document order instead
     * picks up both, interleaved as they actually appear — plus content controls (SDT), which
     * some templates use to bind fields such as the cover page's organisation name.
     */
    private String extractFromDocx(InputStream docxStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(docxStream)) {
            StringBuilder text = new StringBuilder();
            for (IBodyElement element : document.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    SpecTextUtils.appendIfNotBlank(text, paragraph.getText());
                } else if (element instanceof XWPFTable table) {
                    appendTable(text, table);
                } else if (element instanceof XWPFSDT sdt) {
                    SpecTextUtils.appendIfNotBlank(text, sdt.getContent().getText());
                }
            }
            return text.toString().strip();
        }
    }

    /**
     * A content-control cell (e.g. a "Company" field bound to a document property) is a
     * sibling of the plain {@code <w:tc>} cells in the row's XML, not one of them —
     * {@link XWPFTableRow#getTableCells()} silently skips it. {@link XWPFTableRow#getTableICells()}
     * returns both cell kinds in their actual column order, so every cell of the row makes it in.
     */
    private void appendTable(StringBuilder text, XWPFTable table) {
        for (XWPFTableRow row : table.getRows()) {
            String rowText = SpecTextUtils.joinRow(row.getTableICells().stream().map(this::cellText));
            SpecTextUtils.appendIfNotBlank(text, rowText);
        }
    }

    private String cellText(ICell cell) {
        if (cell instanceof XWPFTableCell tableCell) {
            return tableCell.getTextRecursively();
        }
        if (cell instanceof XWPFSDTCell sdtCell) {
            return sdtCell.getContent().getText();
        }
        return "";
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
