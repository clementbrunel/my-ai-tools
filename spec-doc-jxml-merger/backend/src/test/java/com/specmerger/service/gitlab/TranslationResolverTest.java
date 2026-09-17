package com.specmerger.service.gitlab;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TranslationResolverTest {

    @Test
    void resolvesAKeyFromAPropertiesFileMatchingTheLanguage() {
        Map<String, String> files = Map.of(
                "resources/fr.properties", "117=Standard / Liste\n118=Boîte 1",
                "resources/en.properties", "117=Standard / List\n118=Box 1");

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");
        String resolved = TranslationResolver.resolve("<Label>trans(117)</Label>", translations);

        assertThat(resolved).isEqualTo("<Label>Standard / Liste</Label>");
    }

    @Test
    void leavesUnresolvedTransCallsUntouched() {
        Map<String, String> translations = Map.of("117", "Standard / Liste");

        String resolved = TranslationResolver.resolve("<Label>trans(999)</Label>", translations);

        assertThat(resolved).isEqualTo("<Label>trans(999)</Label>");
    }

    @Test
    void reportsStillUnresolvedKeysAfterResolution() {
        Map<String, String> translations = Map.of("117", "Standard / Liste");
        String resolved = TranslationResolver.resolve("trans(117) trans(999) trans(999)", translations);

        List<String> unresolved = TranslationResolver.findUnresolvedKeys(resolved);

        assertThat(unresolved).containsExactly("999");
    }

    @Test
    void resolvesAKeyContainingAQuestionMark() {
        Map<String, String> files = Map.of(
                "resources/fr.properties",
                "label.71.quels.bulletins.souhaitez.vous.obtenir?=Quels bulletins souhaitez-vous obtenir?");

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");
        String resolved = TranslationResolver.resolve(
                "<Label>trans(label.71.quels.bulletins.souhaitez.vous.obtenir?)</Label>", translations);

        assertThat(resolved).isEqualTo("<Label>Quels bulletins souhaitez-vous obtenir?</Label>");
    }

    @Test
    void ignoresATranslationFileForAnotherLanguage() {
        Map<String, String> files = Map.of("resources/de.properties", "117=Standard / Liste (DE)");

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");

        assertThat(translations).isEmpty();
    }

    @Test
    void resolvesAKeyFromXliffUsingTargetLanguageAttribute() {
        String xlf = """
                <xliff version="1.2">
                  <file source-language="fr" target-language="en">
                    <body>
                      <trans-unit id="117">
                        <source>Standard / Liste</source>
                        <target>Standard / List</target>
                      </trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = Map.of("resources/messages.xlf", xlf);

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "en");
        String resolved = TranslationResolver.resolve("trans(117)", translations);

        assertThat(resolved).isEqualTo("Standard / List");
    }

    @Test
    void resolvesAKeyFromXliffUsingSourceLanguageAttribute() {
        String xlf = """
                <xliff version="1.2">
                  <file source-language="fr" target-language="en">
                    <body>
                      <trans-unit id="117">
                        <source>Standard / Liste</source>
                        <target>Standard / List</target>
                      </trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = Map.of("resources/messages.xlf", xlf);

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");
        String resolved = TranslationResolver.resolve("trans(117)", translations);

        assertThat(resolved).isEqualTo("Standard / Liste");
    }

    @Test
    void fallsBackToFileNameWhenXliffDeclaresNoLanguageAttributes() {
        String xlf = """
                <xliff version="1.2">
                  <file>
                    <body>
                      <trans-unit id="117">
                        <target>Box 1</target>
                      </trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = Map.of("resources/en.xlf", xlf);

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "en");

        assertThat(translations).containsEntry("117", "Box 1");
    }

    @Test
    void resolvesAKeyFromXliffUsingTheUnitsOwnSourceLanguageAttributeEvenWhenTheFileTargetsAnotherLanguage() {
        // Real JWAY exports: <file> only declares its own target-language ("de"/"en", matching
        // the file's own name suffix), while each <trans-unit>'s <source> carries the master
        // French text with its own xml:lang="fr" — the signal buildTranslations must key off to
        // resolve "fr", since the file-level attributes alone say nothing about French at all.
        String deXlf = """
                <xliff version="1.2">
                  <file target-language="de">
                    <body>
                      <trans-unit id="3">
                        <source xml:lang="fr">Boîte postale</source>
                        <target>Postfach</target>
                      </trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        String enXlf = """
                <xliff version="1.2">
                  <file target-language="en">
                    <body>
                      <trans-unit id="3">
                        <source xml:lang="fr">Boîte postale</source>
                        <target>P.O. box</target>
                      </trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = Map.of(
                "translation/addressBlock/include_address_Part_BP_de.xlf", deXlf,
                "translation/addressBlock/include_address_Part_BP_en.xlf", enXlf);

        Map<String, String> translations = TranslationResolver.buildTranslations(
                files, "include_address_Part_BP", "fr");

        assertThat(translations).containsExactly(Map.entry("3", "Boîte postale"));
    }

    @Test
    void scopesAnXliffFamilyToItsOwnDocumentAndIgnoresAnotherDocumentsSameId() {
        // include_address_Part_BP and include_address_Part_BU each publish their own
        // fr/en/de.xlf family and independently number their keys starting at 1 — id "3" means
        // a different field in each, so building translations for one document must not see
        // (or conflict with) the other's file at all.
        String bpFr = """
                <xliff version="1.2">
                  <file target-language="fr">
                    <body>
                      <trans-unit id="3"><source>Boîte postale</source><target>Boîte postale</target></trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        String buFr = """
                <xliff version="1.2">
                  <file target-language="fr">
                    <body>
                      <trans-unit id="3"><source>Case postale</source><target>Case postale</target></trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = Map.of(
                "translation/include_address_Part_BP_fr.xlf", bpFr,
                "translation/include_address_Part_BU_fr.xlf", buFr);

        Map<String, String> bpTranslations = TranslationResolver.buildTranslations(files, "include_address_Part_BP", "fr");
        Map<String, String> buTranslations = TranslationResolver.buildTranslations(files, "include_address_Part_BU", "fr");

        assertThat(bpTranslations).containsExactly(Map.entry("3", "Boîte postale"));
        assertThat(buTranslations).containsExactly(Map.entry("3", "Case postale"));
    }

    @Test
    void resolveAllResolvesEachJxmlDocumentAgainstOnlyItsOwnXliffFamilyWithoutCrossDocumentWarnings() {
        String bpFr = """
                <xliff version="1.2">
                  <file target-language="fr">
                    <body>
                      <trans-unit id="3"><source>Boîte postale</source><target>Boîte postale</target></trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        String buFr = """
                <xliff version="1.2">
                  <file target-language="fr">
                    <body>
                      <trans-unit id="3"><source>Case postale</source><target>Case postale</target></trans-unit>
                    </body>
                  </file>
                </xliff>
                """;
        Map<String, String> files = new java.util.LinkedHashMap<>();
        files.put("forms/include_address_Part_BP.jxml", "<Label>trans(3)</Label>");
        files.put("forms/include_address_Part_BU.jxml", "<Label>trans(3)</Label>");
        files.put("translation/include_address_Part_BP_fr.xlf", bpFr);
        files.put("translation/include_address_Part_BU_fr.xlf", buFr);

        Map<String, String> resolved = TranslationResolver.resolveAll(files, "fr");

        assertThat(resolved.get("forms/include_address_Part_BP.jxml")).isEqualTo("<Label>Boîte postale</Label>");
        assertThat(resolved.get("forms/include_address_Part_BU.jxml")).isEqualTo("<Label>Case postale</Label>");
        assertThat(resolved.get("translation/include_address_Part_BP_fr.xlf")).isEqualTo(bpFr);
    }

    @Test
    void ignoresNonTranslationFiles() {
        Map<String, String> files = Map.of("forms/demarche.jxml", "117=not a translation");

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");

        assertThat(translations).isEmpty();
    }

    @Test
    void identifiesTranslationFilesByExtension() {
        assertThat(TranslationResolver.isTranslationFile("resources/fr.properties")).isTrue();
        assertThat(TranslationResolver.isTranslationFile("resources/messages.xlf")).isTrue();
        assertThat(TranslationResolver.isTranslationFile("forms/demarche.jxml")).isFalse();
    }

    @Test
    void keepsTheFirstValueWhenTwoFilesDisagreeOnTheSameKey() {
        Map<String, String> files = Map.of(
                "group-a/fr.properties", "117=Premiere valeur",
                "group-b/fr.properties", "117=Autre valeur");

        Map<String, String> translations = TranslationResolver.buildTranslations(files, "fr");

        assertThat(translations.get("117")).isIn("Premiere valeur", "Autre valeur");
    }
}
