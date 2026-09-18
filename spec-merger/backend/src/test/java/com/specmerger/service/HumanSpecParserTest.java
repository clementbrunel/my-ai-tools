package com.specmerger.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class HumanSpecParserTest {

    private final HumanSpecParser parser = new HumanSpecParser(new WordSpecParser(), new ExcelSpecParser());

    @Test
    void routesAnXlsxFileToTheExcelParser() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            workbook.createSheet("Ecran 1").createRow(0).createCell(0).setCellValue("Champ");
            workbook.write(bytes);
        }

        String text = parser.extractText("spec.xlsx", new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("## Ecran 1\n\n| Champ |\n| --- |");
    }

    @Test
    void routesAnXlsxFileToTheExcelParserRegardlessOfCase() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            workbook.createSheet("Ecran 1").createRow(0).createCell(0).setCellValue("Champ");
            workbook.write(bytes);
        }

        String text = parser.extractText("SPEC.XLSX", new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("## Ecran 1\n\n| Champ |\n| --- |");
    }

    @Test
    void routesADocxFileToTheWordParser() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Ecran de connexion");
            document.write(bytes);
        }

        String text = parser.extractText("spec.docx", new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("Ecran de connexion");
    }

    @Test
    void fallsBackToTheWordParserWhenThereIsNoFilename() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Ecran de connexion");
            document.write(bytes);
        }

        String text = parser.extractText(null, new ByteArrayInputStream(bytes.toByteArray()));

        assertThat(text).isEqualTo("Ecran de connexion");
    }
}
