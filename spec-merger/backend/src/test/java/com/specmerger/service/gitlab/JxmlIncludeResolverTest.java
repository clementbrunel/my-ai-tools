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
    void substitutesAnOpenCloseIncludeTagJustLikeASelfClosingOne() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"section_un\"></Include></JForm>");
        files.put("forms/section_un.jxml", "<Section><Title>Un</Title></Section>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><Section><Title>Un</Title></Section></JForm>");
    }

    @Test
    void unwrapsAnIncludeDocumentTargetKeepingOnlyItsContentBlock() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"include_adresse\" /></JForm>");
        files.put("forms/include_adresse.jxml",
                "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
                        + "<!--Produced by FormPublisher Studio Version: 3.5.009-->\n"
                        + "<!DOCTYPE IncludeDocument PUBLIC \"-//JWAY//JFORM//FR\" \"./JForm.dtd\">\n"
                        + "<IncludeDocument Language=\"fr\" DocumentId=\"include_adresse\">\n"
                        + "<Content OutputMode=\"all\" OutputTarget=\"all\" NewPage=\"none\">"
                        + "<Section><Title>Adresse</Title></Section>"
                        + "</Content>\n"
                        + "</IncludeDocument>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><Content OutputMode=\"all\" OutputTarget=\"all\" NewPage=\"none\">"
                + "<Section><Title>Adresse</Title></Section></Content></JForm>");
        assertThat(resolved).doesNotContain("<?xml").doesNotContain("<!DOCTYPE").doesNotContain("<IncludeDocument");
    }

    @Test
    void unwrapsAnIncludeDocumentTargetWhoseFirstElementIsNotContent() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"section_only\" /></JForm>");
        files.put("forms/section_only.jxml",
                "<IncludeDocument Language=\"fr\" DocumentId=\"section_only\"><Section/></IncludeDocument>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo("<JForm><Section/></JForm>");
    }

    @Test
    void leavesAnIncludeDocumentTargetUntouchedWhenItHasNoInnerElement() {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("forms/demarche.jxml", "<JForm><Include DocumentId=\"empty\" /></JForm>");
        files.put("forms/empty.jxml", "<IncludeDocument Language=\"fr\" DocumentId=\"empty\"></IncludeDocument>");

        String resolved = JxmlIncludeResolver.resolve("forms/demarche.jxml", files);

        assertThat(resolved).isEqualTo(
                "<JForm><IncludeDocument Language=\"fr\" DocumentId=\"empty\"></IncludeDocument></JForm>");
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
    void reportsAnUnmatchedIncludeTagAsAWarningInsteadOfLeavingItSilentlyUnreplaced() {
        // Missing quotes around the DocumentId value: doesn't match INCLUDE_TAG, so resolve()
        // never touches it — this is the safety net that surfaces it anyway (see the report of
        // a checked Include silently staying unreplaced with no warning in the preview modal).
        List<String> warnings = JxmlIncludeResolver.findWarnings("<JForm><Include DocumentId=x/></JForm>");

        assertThat(warnings).anySatisfy(w -> assertThat(w).contains("<Include").contains("non traitée"));
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
