package com.mymoneyhub.importer;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the CSV export of Linxo (columns {@code Date, Libellé, Catégorie, Montant, Notes, N° de chèque, Labels,
 * Nom du compte, Nom de la connexion}). Columns are found by header name so their order does not matter; the
 * separator ({@code ;} {@code ,} or tab) and the charset (UTF-8 with/without BOM, else windows-1252) are detected.
 * Malformed rows are reported and skipped rather than failing the whole file.
 */
@Component
public class LinxoCsvParser {

    private static final Charset WINDOWS_1252 = Charset.forName("windows-1252");
    private static final DateTimeFormatter FR_DATE = DateTimeFormatter.ofPattern("d/M/uuuu");
    private static final int MAX_ERRORS = 50;

    public record ParseResult(List<LinxoRow> rows, List<String> errors, int rejected) {
    }

    public ParseResult parse(byte[] content) {
        String text = decode(content);
        char delimiter = detectDelimiter(text);
        CSVFormat format = CSVFormat.DEFAULT.builder().setDelimiter(delimiter).setIgnoreEmptyLines(true).build();

        List<LinxoRow> rows = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int rejected = 0;
        try (CSVParser parser = format.parse(new StringReader(text))) {
            Map<String, Integer> columns = null;
            for (CSVRecord record : parser) {
                if (columns == null) {
                    columns = indexHeaders(record);
                    continue;
                }
                try {
                    rows.add(toRow(record, columns));
                } catch (IllegalArgumentException e) {
                    rejected++;
                    if (errors.size() < MAX_ERRORS) {
                        errors.add("Ligne " + record.getRecordNumber() + " : " + e.getMessage());
                    }
                }
            }
            if (columns == null) {
                throw new IllegalArgumentException("Fichier vide");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Fichier CSV illisible : " + e.getMessage(), e);
        }
        return new ParseResult(rows, errors, rejected);
    }

    private LinxoRow toRow(CSVRecord record, Map<String, Integer> columns) {
        String account = value(record, columns.get("account"));
        if (account.isEmpty()) {
            throw new IllegalArgumentException("nom de compte vide");
        }
        return new LinxoRow(
                (int) record.getRecordNumber(),
                parseDate(value(record, columns.get("date"))),
                value(record, columns.get("label")),
                value(record, columns.get("category")),
                parseAmount(value(record, columns.get("amount"))),
                value(record, columns.get("notes")),
                account,
                value(record, columns.get("connection")));
    }

    private Map<String, Integer> indexHeaders(CSVRecord header) {
        Map<String, Integer> byName = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            byName.putIfAbsent(normalize(header.get(i)), i);
        }
        Map<String, Integer> columns = new HashMap<>();
        columns.put("date", require(byName, "date"));
        columns.put("amount", require(byName, "montant"));
        columns.put("account", require(byName, "nom du compte"));
        Integer connection = byName.getOrDefault("nom de la connexion", byName.get("nom de la banque"));
        if (connection == null) {
            throw new IllegalArgumentException("Colonne manquante : « Nom de la connexion »");
        }
        columns.put("connection", connection);
        putOptional(columns, "label", byName.get("libelle"));
        putOptional(columns, "category", byName.get("categorie"));
        putOptional(columns, "notes", byName.get("notes"));
        return columns;
    }

    private static int require(Map<String, Integer> byName, String name) {
        Integer index = byName.get(name);
        if (index == null) {
            throw new IllegalArgumentException("Colonne manquante : « " + name + " » — est-ce bien un export Linxo ?");
        }
        return index;
    }

    private static void putOptional(Map<String, Integer> columns, String key, Integer index) {
        if (index != null) {
            columns.put(key, index);
        }
    }

    private static String value(CSVRecord record, Integer index) {
        if (index == null || index >= record.size()) {
            return "";
        }
        return record.get(index).trim();
    }

    static LocalDate parseDate(String raw) {
        try {
            return raw.contains("/") ? LocalDate.parse(raw, FR_DATE) : LocalDate.parse(raw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("date invalide « " + raw + " »");
        }
    }

    /** Accepts {@code -1 234,56}, {@code 76,13}, {@code -40}, {@code 12.5} and the unicode minus sign. */
    static BigDecimal parseAmount(String raw) {
        String s = raw.replace("−", "-").replace(" ", "").replace(" ", "").replace("€", "");
        if (s.contains(",")) {
            s = s.replace(".", "").replace(',', '.');
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("montant invalide « " + raw + " »");
        }
    }

    static String normalize(String header) {
        String stripped = Normalizer.normalize(header, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return stripped.replace("﻿", "").trim().toLowerCase().replaceAll("\\s+", " ");
    }

    static String decode(byte[] bytes) {
        int offset = bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF ? 3 : 0;
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset))
                    .toString();
        } catch (CharacterCodingException e) {
            return new String(bytes, offset, bytes.length - offset, WINDOWS_1252);
        }
    }

    static char detectDelimiter(String text) {
        int end = text.indexOf('\n');
        String header = end < 0 ? text : text.substring(0, end);
        int semicolons = count(header, ';');
        int commas = count(header, ',');
        int tabs = count(header, '\t');
        if (tabs > semicolons && tabs > commas) {
            return '\t';
        }
        return commas > semicolons ? ',' : ';';
    }

    private static int count(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) {
                n++;
            }
        }
        return n;
    }
}
