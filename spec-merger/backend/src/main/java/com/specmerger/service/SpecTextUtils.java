package com.specmerger.service;

import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Plumbing shared by {@link WordSpecParser} and {@link ExcelSpecParser}: both flatten a tabular
 * structure (Word table rows, Excel sheet rows) into "cell | cell | cell" text lines, skipping
 * whatever comes out blank once trimmed.
 */
final class SpecTextUtils {

    private SpecTextUtils() {
    }

    static void appendIfNotBlank(StringBuilder text, String value) {
        if (value != null && !value.isBlank()) {
            text.append(value).append('\n');
        }
    }

    static String joinRow(Stream<String> cells) {
        return cells.map(String::strip).collect(Collectors.joining(" | "));
    }
}
