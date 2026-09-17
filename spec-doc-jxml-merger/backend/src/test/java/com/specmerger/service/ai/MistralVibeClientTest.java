package com.specmerger.service.ai;

import com.specmerger.service.JxmlTagDocRepository;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class MistralVibeClientTest {

    private static final JxmlTagDocRepository TAG_DOCS = new JxmlTagDocRepository();

    @Test
    void generateSpecFromJxmlReturnsTheModelsAnswer() {
        AtomicReference<Prompt> receivedPrompt = new AtomicReference<>();
        MistralVibeClient client = clientRespondingWith(receivedPrompt, "## Écran 1\n...");

        String result = client.generateSpecFromJxml("<JForm><Section NewPage=\"screen\"><Content/></Section></JForm>");

        assertThat(result).isEqualTo("## Écran 1\n...");
        assertThat(promptText(receivedPrompt.get())).contains("<JForm>");
    }

    @Test
    void generateSpecFromJxmlIncludesTheDocumentationTemplate() {
        AtomicReference<Prompt> receivedPrompt = new AtomicReference<>();
        MistralVibeClient client = clientRespondingWith(receivedPrompt, "spec");

        client.generateSpecFromJxml("<JForm/>");

        String prompt = promptText(receivedPrompt.get());
        assertThat(prompt).contains("Gabarit de documentation fonctionnelle");
        assertThat(prompt).contains("Contenu — détail par section et par écran");
        assertThat(prompt).contains("Pièces jointes");
        assertThat(prompt).contains("Appels de service web");
    }

    @Test
    void generateSpecFromJxmlPrependsMatchingTagDocs() {
        AtomicReference<Prompt> receivedPrompt = new AtomicReference<>();
        MistralVibeClient client = clientRespondingWith(receivedPrompt, "spec");

        client.generateSpecFromJxml("<JForm><Content OutputMode=\"all\"/></JForm>");

        assertThat(promptText(receivedPrompt.get())).contains("# Content");
    }

    @Test
    void generateSpecFromJxmlFallsBackWhenTheModelCallFails() {
        MistralVibeClient client = new MistralVibeClient(
                prompt -> { throw new RuntimeException("boom"); }, "", TAG_DOCS);

        String result = client.generateSpecFromJxml("<JForm/>");

        assertThat(result).contains("indisponible").contains("<JForm/>");
    }

    @Test
    void generateSpecFromWordReturnsTheModelsAnswer() {
        AtomicReference<Prompt> receivedPrompt = new AtomicReference<>();
        MistralVibeClient client = clientRespondingWith(receivedPrompt, "## Écran 1\n...");

        String result = client.generateSpecFromWord("Nom du champ: obligatoire");

        assertThat(result).isEqualTo("## Écran 1\n...");
        assertThat(promptText(receivedPrompt.get())).contains("Nom du champ: obligatoire");
    }

    @Test
    void generateSpecFromWordIncludesTheDocumentationTemplate() {
        AtomicReference<Prompt> receivedPrompt = new AtomicReference<>();
        MistralVibeClient client = clientRespondingWith(receivedPrompt, "spec");

        client.generateSpecFromWord("Texte source");

        String prompt = promptText(receivedPrompt.get());
        assertThat(prompt).contains("Gabarit de documentation fonctionnelle");
        assertThat(prompt).contains("Contenu — détail par section et par écran");
        assertThat(prompt).contains("Pièces jointes");
        assertThat(prompt).contains("Appels de service web");
    }

    @Test
    void generateSpecFromWordFallsBackWhenTheModelReturnsBlank() {
        MistralVibeClient client = clientRespondingWith(new AtomicReference<>(), "   ");

        String result = client.generateSpecFromWord("Texte source");

        assertThat(result).contains("indisponible").contains("Texte source");
    }

    @Test
    void generateSpecFromJxmlEscapesUnescapedPipesInsideTableCellCodeSpans() {
        String modelAnswer = "| Élément | Condition d'affichage |\n"
                + "|---|---|\n"
                + "| `Nom` | `$(data|demandePersonnelle)=='NON'` |\n";
        MistralVibeClient client = clientRespondingWith(new AtomicReference<>(), modelAnswer);

        String result = client.generateSpecFromJxml("<JForm/>");

        assertThat(result).contains("`$(data\\|demandePersonnelle)=='NON'`");
        assertThat(result).doesNotContain("`$(data|demandePersonnelle)=='NON'`");
    }

    @Test
    void generateSpecFromJxmlLeavesAlreadyEscapedPipesUntouched() {
        String modelAnswer = "| Élément | Condition d'affichage |\n"
                + "|---|---|\n"
                + "| `Nom` | `$(data\\|demandePersonnelle)=='NON'` |\n";
        MistralVibeClient client = clientRespondingWith(new AtomicReference<>(), modelAnswer);

        String result = client.generateSpecFromJxml("<JForm/>");

        assertThat(result).contains("`$(data\\|demandePersonnelle)=='NON'`");
        assertThat(result).doesNotContain("\\\\|");
    }

    @Test
    void generateSpecFromJxmlDoesNotTouchPipesOutsideTableRows() {
        String modelAnswer = "Texte libre avec un | qui n'est pas un tableau.\n";
        MistralVibeClient client = clientRespondingWith(new AtomicReference<>(), modelAnswer);

        String result = client.generateSpecFromJxml("<JForm/>");

        assertThat(result).isEqualTo(modelAnswer);
    }

    private static MistralVibeClient clientRespondingWith(AtomicReference<Prompt> receivedPrompt, String answer) {
        ChatModel fake = prompt -> {
            receivedPrompt.set(prompt);
            return new ChatResponse(List.of(new Generation(new AssistantMessage(answer))));
        };
        return new MistralVibeClient(fake, "", TAG_DOCS);
    }

    private static String promptText(Prompt prompt) {
        return prompt.getInstructions().stream()
                .map(m -> m.getText() == null ? "" : m.getText())
                .reduce("", String::concat);
    }
}
