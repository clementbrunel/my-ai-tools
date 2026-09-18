package com.specmerger.service;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExcelSpecParserTest {

    private final ExcelSpecParser parser = new ExcelSpecParser();

    @Test
    void extractsASingleSheetAsASection() throws IOException {
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Informations générales");
            setRow(sheet.createRow(0), "Nom", "Démarche X");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n",
                "## Informations générales",
                "Nom | Démarche X"));
    }

    @Test
    void extractsEachSheetAsItsOwnSectionInOrder() throws IOException {
        byte[] bytes = workbook(workbook -> {
            Sheet general = workbook.createSheet("Général");
            setRow(general.createRow(0), "Nom", "Démarche X");

            Sheet screen = workbook.createSheet("Ecran 1");
            setRow(screen.createRow(0), "Champ", "Libellé");
            setRow(screen.createRow(1), "login", "Identifiant");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n",
                "## Général",
                "Nom | Démarche X",
                "",
                "## Ecran 1",
                "Champ | Libellé",
                "login | Identifiant"));
    }

    @Test
    void skipsRowsThatAreBlankOnceTrimmed() throws IOException {
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Ecran 1");
            setRow(sheet.createRow(0), "Champ", "Libellé");
            setRow(sheet.createRow(1), "", "");
            setRow(sheet.createRow(2), "login", "Identifiant");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n",
                "## Ecran 1",
                "Champ | Libellé",
                "login | Identifiant"));
    }

    @Test
    void omitsSheetsThatHaveNoContent() throws IOException {
        byte[] bytes = workbook(workbook -> {
            workbook.createSheet("Notes");
            Sheet screen = workbook.createSheet("Ecran 1");
            setRow(screen.createRow(0), "Champ", "Libellé");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n",
                "## Ecran 1",
                "Champ | Libellé"));
    }

    @Test
    void rejectsAnUnrecognisedFormat() {
        byte[] notAnExcelFile = "not an excel file".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> parser.extractText(new ByteArrayInputStream(notAnExcelFile)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(".xlsx");
    }

    private byte[] workbook(java.util.function.Consumer<XSSFWorkbook> build) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            build.accept(workbook);
            workbook.write(bytes);
        }
        return bytes.toByteArray();
    }

    private void setRow(Row row, String... values) {
        for (int i = 0; i < values.length; i++) {
            row.createCell(i).setCellValue(values[i]);
        }
    }
}
