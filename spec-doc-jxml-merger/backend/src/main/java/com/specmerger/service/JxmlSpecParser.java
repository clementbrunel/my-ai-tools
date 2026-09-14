package com.specmerger.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Reads JXML sources, either as an uploaded archive of a JWAY project (multiple
 * .jxml files, possibly split into nested fragments) or as raw text pasted directly
 * in the UI. Real JXML-aware parsing (JWAY custom tags) is not implemented yet —
 * it needs the JWAY documentation, to be supplied separately — see SPEC.md.
 */
@Component
public class JxmlSpecParser {

    public Map<String, String> extractFromZip(InputStream zipStream) throws IOException {
        Map<String, String> filesByPath = new LinkedHashMap<>();
        try (ZipInputStream zis = new ZipInputStream(zipStream)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory() || !entry.getName().toLowerCase().endsWith(".jxml")) {
                    continue;
                }
                String content = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                filesByPath.put(entry.getName(), content);
            }
        }
        return filesByPath;
    }

    public Map<String, String> fromPastedText(String rawText) {
        Map<String, String> single = new LinkedHashMap<>();
        single.put("pasted.jxml", rawText);
        return single;
    }
}
