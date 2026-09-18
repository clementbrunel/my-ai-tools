package com.specmerger.service;

import com.specmerger.entity.Divergence;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MarkdownGenerator {

    public String generate(String title, List<Divergence> divergences) {
        StringBuilder md = new StringBuilder();
        md.append("# ").append(title == null || title.isBlank() ? "Spécification fusionnée" : title).append("\n\n");

        if (divergences.isEmpty()) {
            md.append("Aucune divergence détectée entre le Word et le JXML.\n");
            return md.toString();
        }

        md.append("## Divergences à valider\n\n");
        int i = 1;
        for (Divergence d : divergences) {
            md.append("### ").append(i++).append(". ").append(d.getSectionRef()).append("\n\n");
            md.append("- **Word** : ").append(nullToPlaceholder(d.getWordExcerpt())).append("\n");
            md.append("- **JXML** : ").append(nullToPlaceholder(d.getJxmlExcerpt())).append("\n");
            md.append("- **Proposition IA** : ").append(nullToPlaceholder(d.getAiProposal())).append("\n\n");
        }
        return md.toString();
    }

    private String nullToPlaceholder(String value) {
        return value == null || value.isBlank() ? "_(absent)_" : value;
    }
}
