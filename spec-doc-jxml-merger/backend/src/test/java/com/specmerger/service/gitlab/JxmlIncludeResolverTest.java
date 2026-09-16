package com.specmerger.service.gitlab;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JxmlIncludeResolverTest {

    @Test
    void substitutesASingleInclude() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"section_un\" /></JForm>");
        files.put("forms/section_un.jxml", "<Section><Title>Un</Title></Section>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><Section><Title>Un</Title></Section></JForm>");
    }

    @Test
    void substitutesNestedIncludesRecursively() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"section_un\" /></JForm>");
        files.put("forms/section_un.jxml", "<Section><Include DocumentId=\"paragraphe\" /></Section>");
        files.put("forms/paragraphe.jxml", "<Paragraph>Texte</Paragraph>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><Section><Paragraph>Texte</Paragraph></Section></JForm>");
    }

    @Test
    void handlesMultipleIncludesAtTheSameLevel() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml",
                "<JForm><Include DocumentId=\"a\" /><Include DocumentId=\"b\" /></JForm>");
        files.put("forms/a.jxml", "<A/>");
        files.put("forms/b.jxml", "<B/>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><A/><B/></JForm>");
    }

    @Test
    void leavesACommentWhenTheIncludedFileIsMissing() {
        Map<String, String> files = Map.of(
                "forms/demarche.jxml", "<JForm><Include DocumentId=\"absent\" /></JForm>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).contains("<!--").contains("absent").contains("introuvable");
    }

    @Test
    void breaksCircularIncludesInsteadOfLoopingForever() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"a\" /></JForm>");
        files.put("forms/a.jxml", "<A><Include DocumentId=\"b\" /></A>");
        files.put("forms/b.jxml", "<B><Include DocumentId=\"a\" /></B>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).contains("<A>").contains("<B>").contains("cycle détecté");
    }

    @Test
    void returnsEmptyStringWhenTheRootFileIsUnknown() {
        assertThat(JxmlIncludeResolver.resolve("forms/missing.jxml", Map.of())).isEmpty();
    }

    @Test
    void reportsNoWarningsForWellFormedContent() {
        List<String> warnings = JxmlIncludeResolver.findWarnings("<JForm><Section><Title>Un</Title></Section></JForm>");

        assertThat(warnings).isEmpty();
    }

    @Test
    void reportsUnresolvedIncludesAsWarnings() {
        Map<String, String> files = Map.of(
                "forms/demarche.jxml", "<JForm><Include DocumentId=\"absent\" /></JForm>");
        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        List<String> warnings = JxmlIncludeResolver.findWarnings(resolved);

        assertThat(warnings).hasSize(1);
        assertThat(warnings.get(0)).contains("absent").contains("introuvable");
    }

    @Test
    void reportsAnUnclosedTagAsAWarning() {
        List<String> warnings = JxmlIncludeResolver.findWarnings("<JForm><Section><Title>Un</Title></Section>");

        assertThat(warnings).anySatisfy(w -> assertThat(w).contains("JForm").contains("jamais refermée"));
    }

    @Test
    void reportsAMismatchedClosingTagAsAWarning() {
        List<String> warnings = JxmlIncludeResolver.findWarnings("<JForm><Section><Title>Un</Section></Title></JForm>");

        assertThat(warnings).anySatisfy(w -> assertThat(w).contains("Imbrication incomplète"));
    }
}
