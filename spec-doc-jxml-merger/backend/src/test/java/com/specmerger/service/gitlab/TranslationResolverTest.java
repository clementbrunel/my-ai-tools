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
