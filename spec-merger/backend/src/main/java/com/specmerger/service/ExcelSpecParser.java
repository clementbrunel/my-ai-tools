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
 * Extracts an Excel specification (.xlsx) as Markdown, the same output shape
 * {@link WordSpecParser} produces. Unlike the Word canevas, a spec workbook already segments
 * itself along a natural boundary — one sheet per section — so each non-empty sheet becomes a
 * "## &lt;nom de la feuille&gt;" heading followed by that sheet's rows as a GFM table (its first
 * row doubling as the header — see {@link SpecTextUtils#formatMarkdownTable}), in sheet order. A
 * real sample workbook has a handful of general/démarche-level sheets before the per-screen ones
 * start, and that count isn't fixed across workbooks, so this deliberately does not try to tell
 * a "general" sheet from a "screen" sheet — every sheet is treated the same way. That already
 * gives the same kind of per-section granularity that {@link WordSpecParser} still has to derive
 * with an as-yet-undefined heuristic (#260/#261).
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
            List<String> blocks = new ArrayList<>();
            for (Sheet sheet : workbook) {
                String table = SpecTextUtils.formatMarkdownTable(sheetRows(sheet, formatter, evaluator));
                if (!table.isBlank()) {
                    blocks.add("## " + sheet.getSheetName());
                    blocks.add(table);
                }
            }
            return String.join("\n\n", blocks).strip();
        }
    }

    private List<List<String>> sheetRows(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator) {
        List<List<String>> rows = new ArrayList<>();
        for (Row row : sheet) {
            List<String> cells = rowCells(row, formatter, evaluator);
            if (!cells.isEmpty()) {
                rows.add(cells);
            }
        }
        return rows;
    }

    /**
     * A sheet's rows are sparse by nature — styled-but-empty cells and trailing empty columns
     * are routine — so trailing blank cells are trimmed off, and a row that comes out empty
     * altogether is dropped rather than surfacing as an empty table row.
     */
    private List<String> rowCells(Row row, DataFormatter formatter, FormulaEvaluator evaluator) {
        List<String> cells = StreamSupport.stream(row.spliterator(), false)
                .map(cell -> cellText(cell, formatter, evaluator))
                .collect(Collectors.toCollection(ArrayList::new));
        while (!cells.isEmpty() && cells.get(cells.size() - 1).isBlank()) {
            cells.remove(cells.size() - 1);
        }
        return cells.stream().allMatch(String::isBlank) ? List.of() : cells;
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
