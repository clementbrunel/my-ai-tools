package com.specmerger.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/**
 * Picks the right parser for a "spec humaine" upload — Word or Excel — from the file's
 * extension, the same gate the frontend already applies before letting a file through.
 * {@link WordSpecParser} and {@link ExcelSpecParser} each still verify the actual file content
 * (magic bytes) once picked, exactly as before; this only decides which of the two to try, so
 * callers that used to talk to {@link WordSpecParser} directly (analysis, spec generation,
 * preview) don't need to know a second format exists.
 */
@Component
public class HumanSpecParser {

    private final WordSpecParser wordSpecParser;
    private final ExcelSpecParser excelSpecParser;

    public HumanSpecParser(WordSpecParser wordSpecParser, ExcelSpecParser excelSpecParser) {
        this.wordSpecParser = wordSpecParser;
        this.excelSpecParser = excelSpecParser;
    }

    public String extractText(String filename, InputStream stream) throws IOException {
        if (filename != null && filename.toLowerCase().endsWith(".xlsx")) {
            return excelSpecParser.extractText(stream);
        }
        return wordSpecParser.extractText(stream);
    }
}
