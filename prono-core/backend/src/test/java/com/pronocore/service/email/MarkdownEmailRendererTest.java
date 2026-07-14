package com.pronocore.service.email;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MarkdownEmailRendererTest {

    private final MarkdownEmailRenderer renderer = new MarkdownEmailRenderer();

    @Test
    void paragraphsAndLinksGetInlineStyles() {
        String html = renderer.toInlineStyledHtml("Un **paragraphe** avec un [lien](https://example.com).");

        assertThat(html).contains("<p style=");
        assertThat(html).contains("<a ");
        assertThat(html).contains("style=");
        // links open in a new tab safely
        assertThat(html).contains("target=\"_blank\"");
        assertThat(html).contains("rel=\"noopener noreferrer\"");
    }

    @Test
    void headingsAndListsGetInlineStyles() {
        String html = renderer.toInlineStyledHtml("## Titre\n\n- un\n- deux");

        assertThat(html).contains("<h2 style=");
        assertThat(html).contains("<ul style=");
        assertThat(html).contains("<li style=");
    }

    @Test
    void blankInputYieldsEmptyString() {
        assertThat(renderer.toInlineStyledHtml("")).isEmpty();
        assertThat(renderer.toInlineStyledHtml(null)).isEmpty();
    }
}
