package com.specmerger.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSdtCell;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTc;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WordSpecParserTest {

    private final WordSpecParser parser = new WordSpecParser();

    @Test
    void extractsTextFromDocx() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Ecran de connexion");
            document.write(bytes);
        }

        String text = parser.extractText(new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("Ecran de connexion");
    }

    @Test
    void extractsTableContentFromDocx() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Ecran de connexion");
            XWPFTable table = document.createTable(2, 2);
            table.getRow(0).getCell(0).setText("ID");
            table.getRow(0).getCell(1).setText("Libellé");
            table.getRow(1).getCell(0).setText("login");
            table.getRow(1).getCell(1).setText("Identifiant");
            document.createParagraph().createRun().setText("Règles de gestion");
            document.write(bytes);
        }

        String text = parser.extractText(new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo(String.join("\n",
                "Ecran de connexion",
                "ID | Libellé",
                "login | Identifiant",
                "Règles de gestion"));
    }

    @Test
    void extractsContentControlTableCells() throws IOException {
        // Some Word templates bind a table cell's value to a document property via a content
        // control (a "structured document tag") instead of a plain <w:tc> — a real spec document
        // surfaced this: the cell then sits next to, not inside, the row's plain <w:tc> list.
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            XWPFTable table = document.createTable(1, 1);
            XWPFTableRow row = table.getRow(0);
            row.getCell(0).setText("Champ");
            CTSdtCell sdtCell = row.getCtRow().addNewSdt();
            CTTc tc = sdtCell.addNewSdtContent().addNewTc();
            tc.addNewP().addNewR().addNewT().setStringValue("Valeur");
            document.write(bytes);
        }

        String text = parser.extractText(new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("Champ | Valeur");
    }

    @Test
    void rejectsAnUnrecognisedFormat() {
        byte[] notAWordFile = "not a word file".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> parser.extractText(new ByteArrayInputStream(notAWordFile)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(".doc")
                .hasMessageContaining(".docx");
    }
}
