package com.specmerger.service;

import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.poifs.filesystem.FileMagic;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ICell;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFSDT;
import org.apache.poi.xwpf.usermodel.XWPFSDTCell;
import org.apache.poi.xwpf.usermodel.XWPFStyle;
import org.apache.poi.xwpf.usermodel.XWPFStyles;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Extracts the Word specification's content as Markdown, in either the modern OOXML (.docx) or
 * the legacy OLE2 (.doc) format. Which one it is gets detected from the file's own content
 * (magic bytes) rather than trusted from its name/extension, since the two need different POI
 * readers. Splitting the extracted text into logical sections (screens, features...) is not
 * implemented yet — see issues #260 and #261.
 */
@Component
public class WordSpecParser {

    private static final Pattern HEADING_STYLE_NAME = Pattern.compile("(?i)\\b(?:heading|titre)\\s*([1-9])\\b");

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
     * <p>
     * Headings are emitted as Markdown ({@code #}..{@code ######}) and tables as GFM tables, so
     * the result both renders closer to the source document and gives the model (or a human
     * reading the preview) the same structural cues — not just a flat block of text.
     */
    private String extractFromDocx(InputStream docxStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(docxStream)) {
            List<String> blocks = new ArrayList<>();
            for (IBodyElement element : document.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    addIfNotBlank(blocks, formatParagraph(paragraph, document.getStyles()));
                } else if (element instanceof XWPFTable table) {
                    addIfNotBlank(blocks, formatTable(table));
                } else if (element instanceof XWPFSDT sdt) {
                    addIfNotBlank(blocks, sdt.getContent().getText());
                }
            }
            return String.join("\n\n", blocks).strip();
        }
    }

    private String formatParagraph(XWPFParagraph paragraph, XWPFStyles styles) {
        String text = paragraph.getText();
        if (text.isBlank()) {
            return "";
        }
        int level = headingLevel(paragraph, styles);
        return level > 0 ? "#".repeat(level) + " " + text : text;
    }

    /**
     * Prefers the paragraph's outline level ({@code w:outlineLvl}, 0-based — set automatically by
     * Word's built-in heading styles, regardless of their display name/language) and falls back
     * to matching the style name against "HeadingN"/"TitreN" for templates (like the CTIE
     * canevas, which names its section/screen styles "Titre2"/"Titre3") that redefine the style
     * without carrying the outline level over.
     */
    private int headingLevel(XWPFParagraph paragraph, XWPFStyles styles) {
        CTPPr paragraphProperties = paragraph.getCTP().getPPr();
        if (paragraphProperties != null && paragraphProperties.isSetOutlineLvl()) {
            return Math.min(paragraphProperties.getOutlineLvl().getVal().intValue() + 1, 6);
        }
        String styleId = paragraph.getStyle();
        if (styleId == null || styles == null) {
            return 0;
        }
        XWPFStyle style = styles.getStyle(styleId);
        String styleName = style != null ? style.getName() : styleId;
        Matcher matcher = HEADING_STYLE_NAME.matcher(styleName == null ? "" : styleName);
        return matcher.find() ? Math.min(Integer.parseInt(matcher.group(1)), 6) : 0;
    }

    /**
     * A content-control cell (e.g. a "Company" field bound to a document property) is a
     * sibling of the plain {@code <w:tc>} cells in the row's XML, not one of them —
     * {@link XWPFTableRow#getTableCells()} silently skips it. {@link XWPFTableRow#getTableICells()}
     * returns both cell kinds in their actual column order, so every cell of the row makes it in.
     */
    private String formatTable(XWPFTable table) {
        List<List<String>> rows = new ArrayList<>();
        int columnCount = 0;
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = row.getTableICells().stream()
                    .map(this::cellText)
                    .map(WordSpecParser::sanitizeCell)
                    .toList();
            columnCount = Math.max(columnCount, cells.size());
            rows.add(cells);
        }
        if (rows.isEmpty() || columnCount == 0) {
            return "";
        }
        StringBuilder markdown = new StringBuilder();
        for (int i = 0; i < rows.size(); i++) {
            markdown.append(formatRow(rows.get(i), columnCount)).append('\n');
            if (i == 0) {
                // GFM tables have no separate "this is a data table without a header" syntax —
                // the first row must double as the header for the table to render at all.
                markdown.append(formatSeparatorRow(columnCount)).append('\n');
            }
        }
        return markdown.toString().stripTrailing();
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

    /**
     * Markdown table cells can't contain a raw {@code |} or a line break — and
     * {@link XWPFTableCell#getTextRecursively()} joins a cell's own multiple paragraphs with a
     * tab, not a newline, so both need collapsing.
     */
    private static String sanitizeCell(String text) {
        return text.strip().replace("|", "\\|").replaceAll("[\\t\\r\\n]+", " ");
    }

    private static String formatRow(List<String> cells, int columnCount) {
        StringBuilder row = new StringBuilder("|");
        for (int i = 0; i < columnCount; i++) {
            row.append(' ').append(i < cells.size() ? cells.get(i) : "").append(" |");
        }
        return row.toString();
    }

    private static String formatSeparatorRow(int columnCount) {
        return "|" + " --- |".repeat(columnCount);
    }

    private static void addIfNotBlank(List<String> blocks, String value) {
        if (value != null && !value.isBlank()) {
            blocks.add(value.strip());
        }
    }

    /**
     * The legacy binary format has no equivalent of styles/outline levels exposed through
     * {@link WordExtractor}, so headings aren't distinguished here — every paragraph comes out
     * as plain text, one Markdown block per paragraph.
     */
    private String extractFromDoc(InputStream docStream) throws IOException {
        try (WordExtractor extractor = new WordExtractor(docStream)) {
            return Arrays.stream(extractor.getParagraphText())
                    .map(String::trim)
                    .filter(text -> !text.isBlank())
                    .collect(Collectors.joining("\n\n"));
        }
    }
}
