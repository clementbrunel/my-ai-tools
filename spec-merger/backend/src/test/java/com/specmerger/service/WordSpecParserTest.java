package com.specmerger.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
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
    void rejectsAnUnrecognisedFormat() {
        byte[] notAWordFile = "not a word file".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> parser.extractText(new ByteArrayInputStream(notAWordFile)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(".doc")
                .hasMessageContaining(".docx");
    }
}
