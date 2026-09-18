package com.specmerger.service;

import org.apache.poi.poifs.filesystem.FileMagic;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Extracts raw text from an Excel specification (.xlsx). Unlike the Word canevas, a spec
 * workbook already segments itself along a natural boundary — one sheet per section — so each
 * non-empty sheet's rows are emitted under its own "## &lt;nom de la feuille&gt;" heading, in
 * sheet order. A real sample workbook has a handful of general/démarche-level sheets before the
 * per-screen ones start, and that count isn't fixed across workbooks, so this deliberately does
 * not try to tell a "general" sheet from a "screen" sheet — every sheet just becomes its own
 * section, uniformly. That already gives the same kind of per-section granularity that
 * {@link WordSpecParser} still has to derive with an as-yet-undefined heuristic (#260/#261); it
 * produces plain text rather than {@link WordSpecParser}'s exact output shape, but both feed the
 * same downstream pipeline (diff, markdown generation) as unstructured spec text.
 * <p>
 * Splitting a screen's own rows further into fields/business rules (the Word canevas'
 * "Eléments" table) is not attempted — the real column layout of a spec workbook needs
 * confirming against actual sample files first (see #267). Images are ignored for now, same as
 * {@link WordSpecParser} — they may get OCR'd later alongside the PowerPoint work.
 */
@Component
public class ExcelSpecParser {

    public String extractText(InputStream excelStream) throws IOException {
        InputStream prepared = FileMagic.prepareToCheckMagic(excelStream);
        FileMagic magic = FileMagic.valueOf(prepared);
        if (magic != FileMagic.OOXML) {
            throw new IllegalArgumentException(
                    "Format de fichier non reconnu : seul le format .xlsx est accepté.");
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(prepared)) {
            DataFormatter formatter = new DataFormatter();
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            StringBuilder text = new StringBuilder();
            for (Sheet sheet : workbook) {
                String sheetText = extractSheet(sheet, formatter, evaluator);
                if (!sheetText.isBlank()) {
                    text.append("## ").append(sheet.getSheetName()).append('\n').append(sheetText).append('\n');
                }
            }
            return text.toString().strip();
        }
    }

    private String extractSheet(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator) {
        StringBuilder text = new StringBuilder();
        for (Row row : sheet) {
            appendRow(text, row, formatter, evaluator);
        }
        return text.toString();
    }

    /**
     * A sheet's rows are sparse by nature — styled-but-empty cells and trailing empty columns
     * are routine — so a row that is blank once trimmed is dropped entirely rather than
     * surfacing as a noisy "| | " line, and trailing empty cells are trimmed off each kept row.
     */
    private void appendRow(StringBuilder text, Row row, DataFormatter formatter, FormulaEvaluator evaluator) {
        List<String> cells = StreamSupport.stream(row.spliterator(), false)
                .map(cell -> cellText(cell, formatter, evaluator).strip())
                .collect(Collectors.toCollection(ArrayList::new));
        while (!cells.isEmpty() && cells.get(cells.size() - 1).isEmpty()) {
            cells.remove(cells.size() - 1);
        }
        if (cells.isEmpty()) {
            return;
        }
        SpecTextUtils.appendIfNotBlank(text, SpecTextUtils.joinRow(cells.stream()));
    }

    private String cellText(Cell cell, DataFormatter formatter, FormulaEvaluator evaluator) {
        try {
            return formatter.formatCellValue(cell, evaluator);
        } catch (RuntimeException e) {
            // A broken formula (#REF!, an external workbook reference...) shouldn't fail the
            // whole extraction — fall back to whatever POI can render of the cell.
            return cell.toString();
        }
    }
}
