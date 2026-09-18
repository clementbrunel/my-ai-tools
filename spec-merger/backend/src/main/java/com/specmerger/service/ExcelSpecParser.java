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
 * "Eléments" table) is not attempted — verified against a real sample workbook (#267), most
 * "screen" sheets turn out to be a sparse outline (step/field hierarchy spread across many
 * mostly-empty columns, occasionally a small real sub-table) rather than one clean table with a
 * meaningful header row, so the GFM table this produces is a faithful but unglamorous rendering
 * of that outline, not a redesign of it. Images are ignored for now, same as
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

    /**
     * Reads every row across the same fixed column range (0 up to the sheet's widest row) rather
     * than only the cells POI happens to have materialized for each particular row — a row
     * that's missing a leading styled-but-empty cell would otherwise have its real content
     * silently shift left relative to its siblings, so the same spreadsheet column would land in
     * different output columns depending on the row (confirmed against a real spec workbook,
     * #267: a field's row number sits in the same column for every field except where an earlier
     * row happened to have fewer materialized cells). Blank spacer rows are dropped, and any
     * column that comes out blank across every kept row is dropped too — it carries no
     * information but would otherwise pad every remaining row with noise.
     */
    private List<List<String>> sheetRows(Sheet sheet, DataFormatter formatter, FormulaEvaluator evaluator) {
        int columnCount = 0;
        for (Row row : sheet) {
            columnCount = Math.max(columnCount, row.getLastCellNum());
        }
        List<List<String>> rows = new ArrayList<>();
        for (Row row : sheet) {
            List<String> cells = rowCells(row, columnCount, formatter, evaluator);
            if (!isBlank(cells)) {
                rows.add(cells);
            }
        }
        return dropBlankColumns(rows);
    }

    private List<String> rowCells(Row row, int columnCount, DataFormatter formatter, FormulaEvaluator evaluator) {
        List<String> cells = new ArrayList<>(columnCount);
        for (int i = 0; i < columnCount; i++) {
            Cell cell = row.getCell(i, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
            cells.add(cell == null ? "" : cellText(cell, formatter, evaluator));
        }
        return cells;
    }

    private boolean isBlank(List<String> cells) {
        return cells.stream().allMatch(String::isBlank);
    }

    private List<List<String>> dropBlankColumns(List<List<String>> rows) {
        if (rows.isEmpty()) {
            return rows;
        }
        List<Integer> keptColumns = new ArrayList<>();
        int columnCount = rows.get(0).size();
        for (int c = 0; c < columnCount; c++) {
            int column = c;
            if (rows.stream().anyMatch(row -> !row.get(column).isBlank())) {
                keptColumns.add(c);
            }
        }
        List<List<String>> compacted = new ArrayList<>(rows.size());
        for (List<String> row : rows) {
            List<String> compactedRow = new ArrayList<>(keptColumns.size());
            for (int column : keptColumns) {
                compactedRow.add(row.get(column));
            }
            compacted.add(compactedRow);
        }
        return compacted;
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
