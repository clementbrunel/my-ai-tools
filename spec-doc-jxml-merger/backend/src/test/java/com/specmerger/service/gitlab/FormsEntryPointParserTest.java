package com.specmerger.service.gitlab;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FormsEntryPointParserTest {

    @Test
    void extractsBothDocumentIdsFromTheSameSection() {
        String forms = """
                <?xml version="1.0" encoding="UTF-8"?>
                <JForm documentId="FORMS">
                  <Section OutputMode="all" OutputTarget="all" AutoValidation="default" NewPage="screen" Type="standard">
                    <Title> </Title>
                    <Content OutputMode="all" OutputTarget="all" NewPage="none">
                      <Paragraph OutputMode="all" OutputTarget="all" HorizontalAlignment="left" Spacing="normal">
                        <Hyperlink Type="Document" Datastores="userData,draftData" DocumentId="demarche_un" OutputMode="static" MediaType="html" Layout="normal"/>
                        <Hyperlink Type="Document" Datastores="userData,draftData" DocumentId="DEMARCHE_DEUX" OutputMode="static" MediaType="html" Layout="normal"/>
                      </Paragraph>
                    </Content>
                  </Section>
                </JForm>
                """;

        List<String> documentIds = FormsEntryPointParser.extractDocumentIds(forms);

        assertThat(documentIds).containsExactly("demarche_un", "DEMARCHE_DEUX");
    }

    @Test
    void ignoresHyperlinksThatAreNotOfTypeDocument() {
        String forms = """
                <JForm documentId="FORMS">
                  <Hyperlink Type="Url" Value="https://example.com" />
                  <Hyperlink Type="Document" DocumentId="demarche_un" />
                </JForm>
                """;

        List<String> documentIds = FormsEntryPointParser.extractDocumentIds(forms);

        assertThat(documentIds).containsExactly("demarche_un");
    }

    @Test
    void deduplicatesRepeatedDocumentIds() {
        String forms = """
                <JForm documentId="FORMS">
                  <Hyperlink Type="Document" DocumentId="demarche_un" />
                  <Hyperlink Type="Document" DocumentId="demarche_un" />
                </JForm>
                """;

        List<String> documentIds = FormsEntryPointParser.extractDocumentIds(forms);

        assertThat(documentIds).containsExactly("demarche_un");
    }

    @Test
    void returnsEmptyListWithoutThrowingOnMalformedXml() {
        assertThat(FormsEntryPointParser.extractDocumentIds("<JForm><Unclosed>")).isEmpty();
        assertThat(FormsEntryPointParser.extractDocumentIds("")).isEmpty();
    }

    @Test
    void returnsEmptyListWhenNoDocumentHyperlinkIsPresent() {
        String forms = "<JForm documentId=\"FORMS\"><Section /></JForm>";

        assertThat(FormsEntryPointParser.extractDocumentIds(forms)).isEmpty();
    }
}
