package com.specmerger.controller;

import com.specmerger.service.JxmlSpecParser;
import com.specmerger.service.WordSpecParser;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpecGenerationControllerTest {

    private final SpecGenerationController controller =
            new SpecGenerationController(new WordSpecParser(), new JxmlSpecParser(), null);

    @Test
    void usesThePastedTextWhenNoArchiveIsProvided() throws IOException {
        String result = controller.resolveJxmlText(null, "<JForm/>");

        assertThat(result).isEqualTo("<JForm/>");
    }

    @Test
    void concatenatesEveryJxmlFileInTheArchive() throws IOException {
        MockMultipartFile archive = zipOf("a.jxml", "<A/>", "b.jxml", "<B/>");

        String result = controller.resolveJxmlText(archive, null);

        assertThat(result).contains("<A/>").contains("<B/>");
    }

    @Test
    void prefersTheArchiveOverPastedTextWhenBothAreProvided() throws IOException {
        MockMultipartFile archive = zipOf("a.jxml", "<A/>");

        String result = controller.resolveJxmlText(archive, "<Ignored/>");

        assertThat(result).contains("<A/>").doesNotContain("<Ignored/>");
    }

    @Test
    void rejectsWhenNeitherArchiveNorTextIsProvided() {
        assertThatThrownBy(() -> controller.resolveJxmlText(null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> controller.resolveJxmlText(null, "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static MockMultipartFile zipOf(String... nameContentPairs) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bytes)) {
            for (int i = 0; i < nameContentPairs.length; i += 2) {
                zos.putNextEntry(new ZipEntry(nameContentPairs[i]));
                zos.write(nameContentPairs[i + 1].getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
        return new MockMultipartFile("jxmlArchive", "sources.zip", "application/zip", bytes.toByteArray());
    }
}
