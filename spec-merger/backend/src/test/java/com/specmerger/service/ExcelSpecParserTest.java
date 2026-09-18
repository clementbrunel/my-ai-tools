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
    void extractsASingleSheetAsAHeadingAndAGfmTable() throws IOException {
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Informations générales");
            setRow(sheet.createRow(0), "Nom", "Démarche X");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Informations générales",
                String.join("\n",
                        "| Nom | Démarche X |",
                        "| --- | --- |")));
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

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Général",
                String.join("\n",
                        "| Nom | Démarche X |",
                        "| --- | --- |"),
                "## Ecran 1",
                String.join("\n",
                        "| Champ | Libellé |",
                        "| --- | --- |",
                        "| login | Identifiant |")));
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

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Ecran 1",
                String.join("\n",
                        "| Champ | Libellé |",
                        "| --- | --- |",
                        "| login | Identifiant |")));
    }

    @Test
    void omitsSheetsThatHaveNoContent() throws IOException {
        byte[] bytes = workbook(workbook -> {
            workbook.createSheet("Notes");
            Sheet screen = workbook.createSheet("Ecran 1");
            setRow(screen.createRow(0), "Champ", "Libellé");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Ecran 1",
                String.join("\n",
                        "| Champ | Libellé |",
                        "| --- | --- |")));
    }

    @Test
    void doesNotTryToTellHowManyGeneralSheetsPrecedeTheScreens() throws IOException {
        // A real spec workbook has been seen with 5 general/démarche-level sheets before the
        // screens start, and that count isn't fixed across workbooks — so every sheet just
        // becomes its own section, whatever comes before or after it.
        byte[] bytes = workbook(workbook -> {
            for (int i = 1; i <= 5; i++) {
                setRow(workbook.createSheet("Général " + i).createRow(0), "Clé " + i, "Valeur " + i);
            }
            Sheet screen = workbook.createSheet("Ecran 1");
            setRow(screen.createRow(0), "Champ", "Libellé");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Général 1", String.join("\n", "| Clé 1 | Valeur 1 |", "| --- | --- |"),
                "## Général 2", String.join("\n", "| Clé 2 | Valeur 2 |", "| --- | --- |"),
                "## Général 3", String.join("\n", "| Clé 3 | Valeur 3 |", "| --- | --- |"),
                "## Général 4", String.join("\n", "| Clé 4 | Valeur 4 |", "| --- | --- |"),
                "## Général 5", String.join("\n", "| Clé 5 | Valeur 5 |", "| --- | --- |"),
                "## Ecran 1", String.join("\n", "| Champ | Libellé |", "| --- | --- |")));
    }

    @Test
    void escapesPipesAndCollapsesInternalLineBreaksInCells() throws IOException {
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Ecran 1");
            setRow(sheet.createRow(0), "Champ", "Contrainte");
            setRow(sheet.createRow(1), "login", "Requis | unique\nformat email");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Ecran 1",
                String.join("\n",
                        "| Champ | Contrainte |",
                        "| --- | --- |",
                        "| login | Requis \\| unique format email |")));
    }

    @Test
    void keepsCellsAlignedToTheirRealColumnEvenWhenRowsHaveDifferentLeadingGaps() throws IOException {
        // A real spec workbook has rows whose first populated cell sits at very different
        // columns (an outline nested several levels deep vs. a top-level step number) — POI's
        // own row iterator only visits cells it actually materialized for THAT row, so reading
        // "the cells this row has" rather than "column 0 up to the sheet's widest row" would
        // shift row2's "4.2" into the same output column as row1's "Type de demande", even
        // though they live in different spreadsheet columns (0 vs. 2).
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Ecran 1");
            Row row1 = sheet.createRow(0);
            row1.createCell(2).setCellValue("Type de demande");
            row1.createCell(4).setCellValue("4.1.1");
            row1.createCell(6).setCellValue("Nom");
            Row row2 = sheet.createRow(1);
            row2.createCell(0).setCellValue("4.2");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Ecran 1",
                String.join("\n",
                        "|  | Type de demande | 4.1.1 | Nom |",
                        "| --- | --- | --- | --- |",
                        "| 4.2 |  |  |  |")));
    }

    @Test
    void dropsColumnsThatAreBlankInEveryRow() throws IOException {
        // A sheet where column A never carries content (a common shape: labels start in column
        // B, values in column C) shouldn't surface as a permanently empty leading column in
        // every row of the table.
        byte[] bytes = workbook(workbook -> {
            Sheet sheet = workbook.createSheet("Caractéristiques");
            Row row1 = sheet.createRow(0);
            row1.createCell(1).setCellValue("Code de la démarche");
            row1.createCell(2).setCellValue("MJ_EXEMPLE");
            Row row2 = sheet.createRow(1);
            row2.createCell(1).setCellValue("Titre");
            row2.createCell(2).setCellValue("Exemple de démarche");
        });

        String text = parser.extractText(new ByteArrayInputStream(bytes));

        assertThat(text).isEqualTo(String.join("\n\n",
                "## Caractéristiques",
                String.join("\n",
                        "| Code de la démarche | MJ_EXEMPLE |",
                        "| --- | --- |",
                        "| Titre | Exemple de démarche |")));
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
