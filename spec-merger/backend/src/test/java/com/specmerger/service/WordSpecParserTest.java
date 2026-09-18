package com.specmerger.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

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
    void rejectsAnUnrecognisedFormat() {
        byte[] notAWordFile = "not a word file".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> parser.extractText(new ByteArrayInputStream(notAWordFile)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(".doc")
                .hasMessageContaining(".docx");
    }
}
