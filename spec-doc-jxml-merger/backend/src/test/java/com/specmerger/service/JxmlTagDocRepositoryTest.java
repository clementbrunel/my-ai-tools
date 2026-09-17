package com.specmerger.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
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

    /**
     * compactForPrompt() runs four cleaning steps in sequence: strip fenced xml/java
     * examples, strip the JWAY Campus source footer, strip the heading a stripped example
     * leaves dangling, then collapse/trim whitespace. These tests exercise each step with
     * crafted snippets rather than the real jxml-tags/ fiches, so a step's own regex can be
     * pinned down (and a regression in it caught) independently of the others.
     */
    @Nested
    class CompactForPromptTest {

        @Test
        void removesFencedXmlExampleBlock() {
            String raw = "# Foo\n\nTexte avant.\n\n```xml\n<Foo Name=\"a\"/>\n```\n\nTexte après.";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).doesNotContain("```").doesNotContain("<Foo Name=\"a\"/>");
            assertThat(compact).contains("Texte avant.").contains("Texte après.");
        }

        @Test
        void removesFencedJavaExampleBlock() {
            String raw = "# Foo\n\nTexte avant.\n\n```java\npublic class Foo {}\n```\n\nTexte après.";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).doesNotContain("```").doesNotContain("public class Foo {}");
            assertThat(compact).contains("Texte avant.").contains("Texte après.");
        }

        @Test
        void leavesFencedBlocksInOtherLanguagesUntouched() {
            // Only xml/java fences are treated as disposable examples — anything else (a
            // json payload, a shell snippet, …) is left as-is.
            String raw = "# Foo\n\n```json\n{\"a\": 1}\n```\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).contains("```json").contains("{\"a\": 1}");
        }

        @Test
        void removesJwayCampusSourceFooterLine() {
            String raw = "# Foo\n\nCorps de la fiche.\n\n"
                    + "Source : documentation JWAY Campus, page \"Foo\" "
                    + "(https://campus.jway.eu/portal/documentation/step/1234).\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).isEqualTo("# Foo\n\nCorps de la fiche.");
        }

        @Test
        void keepsASourceLineThatIsNotTheJwayCampusFooter() {
            // The footer pattern is deliberately narrow (page-source attribution only) so it
            // doesn't eat unrelated content that happens to start with "Source :".
            String raw = "# Foo\n\nSource : audit interne du 12/01/2024.\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).contains("Source : audit interne du 12/01/2024.");
        }

        @Test
        void removesHeadingLeftDanglingBetweenTwoOtherHeadingsAfterExampleRemoval() {
            String raw = "# Foo\n\n## Exemple de code JXML\n\n```xml\n<Foo/>\n```\n\n"
                    + "## Autre section\n\nContenu utile.";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).doesNotContain("Exemple de code JXML");
            assertThat(compact).contains("## Autre section").contains("Contenu utile.");
        }

        @Test
        void removesHeadingLeftDanglingAtTheEndOfTheDocumentAfterExampleRemoval() {
            String raw = "# Foo\n\nTexte principal.\n\n## Exemple de code JXML\n\n```xml\n<Foo/>\n```\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).isEqualTo("# Foo\n\nTexte principal.");
        }

        @Test
        void keepsAHeadingThatStillHasRealContentAfterItsExampleIsRemoved() {
            // Unlike a purely decorative "## Exemple de code JXML" heading, one that
            // introduces actual explanatory prose (not just the code sample below it) must
            // survive along with that prose, even though the code sample itself is stripped.
            String raw = "# Foo\n\n## Utilisation\n\nCeci explique la fonction.\n\n```xml\n<Foo/>\n```\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).contains("## Utilisation").contains("Ceci explique la fonction.");
            assertThat(compact).doesNotContain("```");
        }

        @Test
        void removesColonTerminatedLeadInLeftDanglingByExampleRemoval() {
            // Not every intro is a "#" heading: AppelREST.md introduces some of its examples
            // with a bold, colon-terminated label/sentence instead (e.g. "**Exemple avec une
            // liste** :"). Once the fenced example is stripped, that label is just as dangling
            // as an empty heading would be, and must go too.
            String raw = "## Mapping\n\nCeci explique le mapping.\n\n**Exemple avec une liste** :\n\n"
                    + "```xml\n<jsonTemplate/>\n```\n\n## Section suivante\n\nContenu utile.";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).doesNotContain("Exemple avec une liste").doesNotContain("```");
            assertThat(compact).contains("Ceci explique le mapping.");
            assertThat(compact).contains("## Section suivante").contains("Contenu utile.");
        }

        @Test
        void removesColonTerminatedLeadInLeftDanglingAtTheEndOfTheDocument() {
            String raw = "# Foo\n\nTexte principal.\n\nLa classe doit étendre `Foo` :\n\n```java\nclass X {}\n```\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).isEqualTo("# Foo\n\nTexte principal.");
        }

        @Test
        void collapsesThreeOrMoreConsecutiveNewlinesIntoOneBlankLine() {
            String raw = "Paragraphe un.\n\n\n\nParagraphe deux.";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).isEqualTo("Paragraphe un.\n\nParagraphe deux.");
        }

        @Test
        void trimsLeadingAndTrailingWhitespace() {
            String raw = "\n\n  # Foo\n\nCorps.\n\n  \n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).isEqualTo("# Foo\n\nCorps.");
        }

        @Test
        void appliesAllCleaningStepsTogetherOnARealisticFiche() {
            // Shaped like the real jxml-tags/ fiches: title, attributes table, a remark,
            // a decorative example, and the page-source footer.
            String raw = "# ComboBox\n\n"
                    + "Affiche une liste déroulante.\n\n"
                    + "## Attributs\n\n"
                    + "| Attribut | Description |\n|---|---|\n| `Name` | Identifiant |\n\n"
                    + "## Remarques\n\n"
                    + "À utiliser pour plus de 10 options.\n\n"
                    + "## Exemple de code JXML\n\n"
                    + "```xml\n<ComboBox Name=\"MyAge\"/>\n```\n\n"
                    + "Source : documentation JWAY Campus, page \"ComboBox\" "
                    + "(https://campus.jway.eu/portal/documentation/step/2785).\n";

            String compact = JxmlTagDocRepository.compactForPrompt(raw);

            assertThat(compact).startsWith("# ComboBox");
            assertThat(compact).contains("## Attributs").contains("| `Name` | Identifiant |");
            assertThat(compact).contains("## Remarques").contains("À utiliser pour plus de 10 options.");
            assertThat(compact).doesNotContain("Exemple de code JXML");
            assertThat(compact).doesNotContain("```").doesNotContain("MyAge");
            assertThat(compact).doesNotContain("Source :").doesNotContain("documentation JWAY Campus");
        }
    }

    /**
     * The synthetic snippets above pin down each regex in isolation, but the real jxml-tags/
     * fiches contain shapes those snippets don't: several examples per fiche, headings with
     * suffixes or embedded bold markup, examples introduced by a sentence rather than a
     * heading, and pre-existing empty headings unrelated to the stripping at all. These tests
     * run compactForPrompt() on the actual borderline fiches found while auditing the corpus,
     * so a change to the regexes gets caught against real content, not just crafted cases.
     */
    @Nested
    class RealFichesEdgeCasesTest {

        @Test
        void stripsBothSuffixedHeadingsAndTheCascadingPreexistingEmptyHeadingAfterThem() throws IOException {
            // lessThan_greaterThan.md has two examples, each under its own suffixed heading
            // ("... - lessThan" / "... - **greaterThan**"), immediately followed by a
            // pre-existing empty "## Mode flow" heading — a three-deep cascade where only the
            // first heading directly introduces a stripped example.
            String compact = loadFiche("controls/lessThan_greaterThan.md");

            assertThat(compact).doesNotContain("```").doesNotContain("Exemple de code");
            assertThat(compact).doesNotContain("Mode flow");
            assertThat(compact).startsWith("# lessThan / greaterThan");
            assertThat(compact).contains("## Paramètres");
            // Legitimate content mentioning "Exemple" without introducing a stripped block
            // (ends in "####", not a heading or dangling colon) must survive.
            assertThat(compact).contains("Exemple de formatage d’un nombre : ####");
        }

        @Test
        void stripsNamedAndUnnamedDanglingHeadingsFromSignatureBox() throws IOException {
            // SignatureBox.md has two examples: one under "## Exemple de code JXML" and a
            // second under a differently-worded "## Code JXML dans le formFlow" — the fix
            // must not be keyed to the word "Exemple" to catch both.
            String compact = loadFiche("inputs/SignatureBox.md");

            assertThat(compact).doesNotContain("```");
            assertThat(compact).doesNotContain("Exemple de code JXML");
            assertThat(compact).doesNotContain("Code JXML dans le formFlow");
            assertThat(compact).contains("## Paramètres de signature");
            assertThat(compact).contains("`phoneNumber` : numéro de téléphone");
            assertThat(compact).contains("## Attributs");
        }

        @Test
        void stripsExampleHeadingAndThePreexistingEmptyHeadingsThatFollowItInIban() throws IOException {
            // IBAN.md's "## Exemple de code JXML" is itself followed by two pre-existing empty
            // headings from the source page ("## Mode flow", "## Rendu visuel") with nothing
            // under them even before any stripping — all three must disappear, while the
            // earlier "## **Exemple**" heading (a bullet list of sample IBANs, not a stripped
            // fenced block) has real content and must be kept.
            String compact = loadFiche("controls/IBAN.md");

            assertThat(compact).doesNotContain("```").doesNotContain("Exemple de code JXML");
            assertThat(compact).doesNotContain("Mode flow").doesNotContain("Rendu visuel");
            assertThat(compact).contains("## **Exemple**").contains("FR7630001007941234567890185");
            assertThat(compact).contains("## Élément qui l’utilise");
        }

        @Test
        void keepsBothPluralExemplesHeadingWithContentAndDropsTheSingularOneLeftEmptyInConstants() throws IOException {
            // Constants.md has both "## Exemples" (a bullet list of True/False — real content,
            // must stay) and "## Exemple de code JXML" (a fenced block only — must go). The
            // near-identical wording proves the cleanup is structural, not keyword-based.
            String compact = loadFiche("expressions/Constants.md");

            assertThat(compact).doesNotContain("```").doesNotContain("Exemple de code JXML");
            assertThat(compact).contains("## Exemples");
            assertThat(compact).contains("Valeur booléenne représentant le vrai");
        }

        @Test
        void keepsDescriptivePropseAroundEachFunctionExampleInDateFunctions() throws IOException {
            // DateFunctions.md repeats "## Exemple d'utilisation de la fonction X()" ~25 times,
            // each followed by real Description/Forme d'appel prose *before* its fenced
            // example — none of those headings are dangling, so all must survive along with
            // their prose, with only the fenced code stripped out from under them.
            String compact = loadFiche("expressions/DateFunctions.md");

            assertThat(compact).doesNotContain("```");
            assertThat(compact).contains("## Exemple d’utilisation de la fonction getDate()");
            assertThat(compact).contains("Retourne la date courante.");
            assertThat(compact).contains("## Exemple d’utilisation de la fonction parseDate()");
            // The literal example code itself is gone even though its heading/prose survive.
            assertThat(compact).doesNotContain("<Variable DataType=\"date\" Expression=\"getDate()\"");
        }

        @Test
        void stripsCascadingDanglingHeadingsAndColonTerminatedLeadInsFromAppelRest() throws IOException {
            // AppelREST.md is the densest fiche: some examples are introduced by a heading
            // ("## JsonTemplate"), others by a bold colon-terminated label ("**Exemple avec
            // une liste** :"), and the very last line of the whole document is itself a
            // colon-terminated lead-in with nothing after it (end of doc, not another
            // heading). All of those must be stripped, while the substantial prose around
            // each (which explains the mechanism, not just the sample) must remain.
            String compact = loadFiche("expressions/AppelREST.md");

            assertThat(compact).doesNotContain("```");
            assertThat(compact).doesNotContain("Exemple avec une liste");
            assertThat(compact).doesNotContain("Donne le **DataStore **suivant");
            assertThat(compact).doesNotContain("La classe Java correspondante doit étendre");
            assertThat(compact).startsWith("# appel REST");
            assertThat(compact).contains("## JsonTemplate").contains("## Mapping").contains("## Properties");
            assertThat(compact).contains("## Sécurisation des services");
            assertThat(compact).contains("## Exemples et ressources").contains("[Projet exemple]");
            assertThat(compact).contains("## Fonction callExtension()");
            assertThat(compact).contains("**Description **:").contains("**Syntaxe **:");
        }

        private String loadFiche(String relativePath) throws IOException {
            try (InputStream is = new ClassPathResource("jxml-tags/" + relativePath).getInputStream()) {
                String raw = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                return JxmlTagDocRepository.compactForPrompt(raw);
            }
        }
    }
}
