package com.specmerger.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JxmlTagDocRepositoryTest {

    private final JxmlTagDocRepository repository = new JxmlTagDocRepository();

    @Test
    void matchesElementTagByName() {
        String jxml = "<Content OutputMode=\"all\"><Paragraph>Texte</Paragraph></Content>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).startsWith("# Content"));
        assertThat(docs).anySatisfy(doc -> assertThat(doc).startsWith("# Paragraph"));
    }

    @Test
    void doesNotConfuseQuestionWithQuestionSet() {
        String jxml = "<QuestionSet><Question><Label>Nom</Label></Question></QuestionSet>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).startsWith("# QuestionSet"));
        assertThat(docs).anySatisfy(doc -> assertThat(doc).startsWith("# Question"));
    }

    @Test
    void matchesControlTypeValue() {
        String jxml = "<TextBox><Control ErrorType=\"error\" Type=\"IBAN\" /></TextBox>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).startsWith("# IBAN"));
    }

    @Test
    void matchesFunctionCallExtractedFromHeadings() {
        String jxml = "<?if (contains($(who), 'Mister'))?><?end-if ?>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).contains("## Fonction contains()"));
    }

    @Test
    void returnsEmptyForBlankOrUnrelatedExcerpt() {
        assertThat(repository.findRelevantDocs(null, 10, 20_000)).isEmpty();
        assertThat(repository.findRelevantDocs("  ", 10, 20_000)).isEmpty();
        assertThat(repository.findRelevantDocs("some unrelated free text without any tag", 10, 20_000)).isEmpty();
    }

    @Test
    void capsNumberOfDocsReturned() {
        String jxml = "<Content><Section><Title/><Paragraph/><List/><Table/></Section></Content>";

        List<String> docs = repository.findRelevantDocs(jxml, 2, 20_000);

        assertThat(docs).hasSize(2);
    }

    @Test
    void matchesCallExtensionFunction() {
        String jxml = "<Variable Expression=\"callExtension(:this, 'MyCustomExtension', 'param1')\" Name=\"Result\" />";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).contains("## Fonction callExtension()"));
    }

    @Test
    void matchesJavaClassExtendingFormPublisherExtension() {
        String javaSnippet = "public class MyCustomExtension extends FormPublisherExtension {\n"
                + "    public Object call(Object... arg) { return null; }\n"
                + "}";

        List<String> docs = repository.findRelevantDocs(javaSnippet, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> assertThat(doc).contains("## Fonction callExtension()"));
    }

    @Test
    void addsDocOnlyOnceEvenWithMultipleOccurrencesOfTheSameTag() {
        String jxml = "<TextBox Name=\"a\"/><TextBox Name=\"b\"/><TextBox Name=\"c\"/>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).filteredOn(doc -> doc.startsWith("# TextBox")).hasSize(1);
    }

    @Test
    void addsDocOnlyOnceEvenWhenMultiplePatternsOfTheSameDocMatch() {
        // Both the callExtension() call and the extending Java class independently
        // match AppelREST's patterns — it must still be included only once.
        String jxml = "<Variable Expression=\"callExtension(:this, 'X')\" />"
                + "public class X extends FormPublisherExtension {}";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).filteredOn(doc -> doc.startsWith("# appel REST")).hasSize(1);
    }
}
