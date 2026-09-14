package com.specmerger.service;

import com.specmerger.dto.DivergenceDraft;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Naive line-level comparison between the Word text and the concatenated JXML text.
 * A real diff needs the actual JWAY grammar (headings, screens, fields) to align
 * sections meaningfully — this heuristic is a placeholder until the JWAY docs and
 * a real granularity (see SPEC.md "Découpage des specs") are available.
 */
@Component
public class DiffEngine {

    public List<DivergenceDraft> diff(String wordText, String jxmlText) {
        Set<String> wordLines = splitLines(wordText);
        Set<String> jxmlLines = splitLines(jxmlText);

        List<DivergenceDraft> divergences = new ArrayList<>();

        for (String line : wordLines) {
            if (!jxmlLines.contains(line)) {
                divergences.add(new DivergenceDraft("document", line, null));
            }
        }
        for (String line : jxmlLines) {
            if (!wordLines.contains(line)) {
                divergences.add(new DivergenceDraft("document", null, line));
            }
        }
        return divergences;
    }

    private Set<String> splitLines(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }
        Set<String> lines = new LinkedHashSet<>();
        for (String line : text.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                lines.add(trimmed);
            }
        }
        return lines;
    }
}
