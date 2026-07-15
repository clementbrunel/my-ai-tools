package com.pronocore.service.email;

import org.commonmark.node.Node;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Converts admin-authored Markdown into <em>inline-styled</em> HTML suitable for
 * email clients. Email clients strip {@code <style>} blocks and ignore CSS
 * classes, so every element must carry its style as a {@code style="..."}
 * attribute — that's what the {@link InlineStyleAttributeProvider} does here.
 * The visual language mirrors the transactional templates so newsletters look
 * like the rest of PronoCore's mail.
 */
@Component
public class MarkdownEmailRenderer {

    private static final Parser PARSER = Parser.builder().build();

    private final HtmlRenderer renderer = HtmlRenderer.builder()
            .sanitizeUrls(true)
            .escapeHtml(true)
            .attributeProviderFactory(context -> new InlineStyleAttributeProvider())
            .build();

    public String toInlineStyledHtml(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }
        Node document = PARSER.parse(markdown);
        return renderer.render(document);
    }

    /** Attaches inline styles per HTML tag as commonmark emits them. */
    private static final class InlineStyleAttributeProvider
            implements org.commonmark.renderer.html.AttributeProvider {

        @Override
        public void setAttributes(Node node, String tagName, Map<String, String> attributes) {
            switch (tagName) {
                case "p" -> attributes.put("style", "color:#444;line-height:1.6;margin:0 0 16px");
                case "h1" -> attributes.put("style", "color:#1a1a1a;font-size:24px;margin:24px 0 12px");
                case "h2" -> attributes.put("style", "color:#1a1a1a;font-size:20px;margin:24px 0 12px");
                case "h3" -> attributes.put("style", "color:#1a1a1a;font-size:17px;margin:20px 0 10px");
                case "ul", "ol" -> attributes.put("style", "color:#444;line-height:1.6;margin:0 0 16px;padding-left:22px");
                case "li" -> attributes.put("style", "margin:0 0 6px");
                case "a" -> {
                    attributes.put("style", "color:#009900;text-decoration:underline");
                    attributes.put("target", "_blank");
                    attributes.put("rel", "noopener noreferrer");
                }
                case "blockquote" -> attributes.put("style",
                        "margin:16px 0;padding:12px 16px;border-left:4px solid #FFD700;background:#fff8e1;color:#555");
                case "hr" -> attributes.put("style", "border:none;border-top:1px solid #eee;margin:24px 0");
                case "code" -> attributes.put("style",
                        "background:#f4f4f4;border-radius:4px;padding:2px 6px;font-family:monospace;font-size:90%");
                case "img" -> attributes.put("style", "max-width:100%;border-radius:8px;margin:8px 0");
                default -> {
                    // strong / em / etc. inherit fine from their parent
                }
            }
        }
    }
}
