package com.specmerger.service;

import java.util.List;

/**
 * Markdown plumbing shared by {@link WordSpecParser} and {@link ExcelSpecParser}: both build a
 * spec's Markdown as a list of blocks (headings, tables...) joined with blank lines, and both
 * flatten a grid of cells (Word table rows, Excel sheet rows) into a GFM table.
 */
final class SpecTextUtils {

    private SpecTextUtils() {
    }

    static void addIfNotBlank(List<String> blocks, String value) {
        if (value != null && !value.isBlank()) {
            blocks.add(value.strip());
        }
    }

    /**
     * GFM has no syntax for a "headerless" table, so the first row always doubles as the header
     * — same convention regardless of whether the source (a Word table, an Excel sheet) actually
     * has a distinguishable header row. Ragged rows are padded with empty cells up to the widest
     * row's column count.
     */
    static String formatMarkdownTable(List<List<String>> rows) {
        int columnCount = rows.stream().mapToInt(List::size).max().orElse(0);
        if (rows.isEmpty() || columnCount == 0) {
            return "";
        }
        StringBuilder markdown = new StringBuilder();
        for (int i = 0; i < rows.size(); i++) {
            markdown.append(formatRow(rows.get(i), columnCount)).append('\n');
            if (i == 0) {
                // GFM tables have no separate "this is a data table without a header" syntax —
                // the first row must double as the header for the table to render at all.
                markdown.append(formatSeparatorRow(columnCount)).append('\n');
            }
        }
        return markdown.toString().stripTrailing();
    }

    /**
     * Markdown table cells can't contain a raw {@code |} or a line break, so both get collapsed
     * — callers pass raw cell text (which may still have internal tabs/newlines from a
     * multi-paragraph cell) rather than pre-sanitizing it themselves.
     */
    private static String sanitizeCell(String text) {
        return text == null ? "" : text.strip().replace("|", "\\|").replaceAll("[\\t\\r\\n]+", " ");
    }

    private static String formatRow(List<String> cells, int columnCount) {
        StringBuilder row = new StringBuilder("|");
        for (int i = 0; i < columnCount; i++) {
            row.append(' ').append(i < cells.size() ? sanitizeCell(cells.get(i)) : "").append(" |");
        }
        return row.toString();
    }

    private static String formatSeparatorRow(int columnCount) {
        return "|" + " --- |".repeat(columnCount);
    }
}
