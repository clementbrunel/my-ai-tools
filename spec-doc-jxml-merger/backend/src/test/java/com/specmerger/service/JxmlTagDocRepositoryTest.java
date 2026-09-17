package com.specmerger.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JxmlTagDocRepositoryTest {

    private final JxmlTagDocRepository repository = new JxmlTagDocRepository();
    private final ListAppender<ILoggingEvent> logAppender = new ListAppender<>();
    private final Logger repositoryLogger = (Logger) LoggerFactory.getLogger(JxmlTagDocRepository.class);

    {
        logAppender.start();
        repositoryLogger.addAppender(logAppender);
    }

    @AfterEach
    void detachAppender() {
        repositoryLogger.detachAppender(logAppender);
    }

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
    void warnsWhenDocsAreDroppedBecauseOfTheDocCountCap() {
        String jxml = "<Content><Section><Title/><Paragraph/><List/><Table/></Section></Content>";

        repository.findRelevantDocs(jxml, 2, 20_000);

        assertThat(logAppender.list)
                .anySatisfy(event -> {
                    assertThat(event.getLevel()).isEqualTo(Level.WARN);
                    assertThat(event.getFormattedMessage()).contains("faute de place");
                    // The char budget (20_000) is nowhere near exhausted here, so the doc-count
                    // cap (2) must be named as the limiting factor, not the character budget.
                    assertThat(event.getFormattedMessage()).contains("nombre de fiches");
                    assertThat(event.getFormattedMessage()).doesNotContain("caractères (cap");
                });
    }

    @Test
    void warnsWhenDocsAreDroppedBecauseOfTheCharBudgetCap() {
        String jxml = "<Content><Section><Title/><Paragraph/></Section></Content>";

        // Tiny char budget: even a single doc's content won't fit, well before the doc-count cap.
        List<String> docs = repository.findRelevantDocs(jxml, 10, 50);

        assertThat(docs).isEmpty();
        assertThat(logAppender.list)
                .anySatisfy(event -> {
                    assertThat(event.getLevel()).isEqualTo(Level.WARN);
                    assertThat(event.getFormattedMessage()).contains("caractères (cap");
                    assertThat(event.getFormattedMessage()).doesNotContain("nombre de fiches (cap");
                });
    }

    @Test
    void doesNotWarnWhenEverythingFits() {
        String jxml = "<Content OutputMode=\"all\" />";

        repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(logAppender.list).noneMatch(event -> event.getLevel() == Level.WARN);
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

    @Test
    void stripsExampleHeadingLeftDanglingOnceItsCodeBlockIsRemoved() {
        // ComboBox.md's fenced example is stripped by compactForPrompt, and its
        // introducing "## Exemple de code JXML" heading must go with it rather than
        // being sent to the prompt with nothing underneath it.
        String jxml = "<ComboBox Name=\"a\"/>";

        List<String> docs = repository.findRelevantDocs(jxml, 10, 20_000);

        assertThat(docs).anySatisfy(doc -> {
            assertThat(doc).startsWith("# ComboBox");
            assertThat(doc).doesNotContain("Exemple de code JXML");
            assertThat(doc).doesNotContain("```");
        });
    }
}
