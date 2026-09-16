package com.specmerger.controller;

import com.specmerger.service.WordSpecParser;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpecGenerationControllerTest {

    private final SpecGenerationController controller =
            new SpecGenerationController(new WordSpecParser(), null);

    @Test
    void acceptsWellFormedJxmlWithoutIncludes() {
        String result = controller.validateJxmlText("<JForm><Section/></JForm>");

        assertThat(result).isEqualTo("<JForm><Section/></JForm>");
    }

    @Test
    void rejectsWhenTextIsMissing() {
        assertThatThrownBy(() -> controller.validateJxmlText(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> controller.validateJxmlText("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsTextContainingAnIncludeTag() {
        assertThatThrownBy(() -> controller.validateJxmlText("<JForm><Include DocumentId=\"X\"/></JForm>"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Include");
    }

    @Test
    void rejectsTextThatIsNotWellFormedXml() {
        assertThatThrownBy(() -> controller.validateJxmlText("<JForm><Unclosed>"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("valide");
    }
}
