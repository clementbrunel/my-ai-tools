package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

/**
 * Renders a newsletter campaign into the shared PronoCore email shell.
 * The body HTML is already inline-styled by
 * {@link com.pronocore.service.email.MarkdownEmailRenderer}; this class only
 * appends the optional CTA button and the opt-out footer.
 */
public final class NewsletterEmailTemplate {

    private NewsletterEmailTemplate() {
    }

    public static String build(EmailTheme theme, String subtitle, String bodyHtml,
                               String ctaLabel, String ctaUrl, String profileUrl) {
        StringBuilder body = new StringBuilder(bodyHtml == null ? "" : bodyHtml);

        if (ctaLabel != null && !ctaLabel.isBlank() && ctaUrl != null && !ctaUrl.isBlank()) {
            body.append("""
                <div style="text-align:center;margin:32px 0">
                  <a href="%s" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;background:%s;color:#fff;text-decoration:none;
                            padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px">%s</a>
                </div>
                """.formatted(ctaUrl, theme.gradientEnd(), escape(ctaLabel)));
        }

        body.append("""
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center;line-height:1.6">
              Tu reçois cet email car tu as un compte PronoCore.<br>
              Pour ne plus recevoir les annonces, désactive « Nouveautés &amp; annonces »
              dans <a href="%s" style="color:#888">ton profil</a>.
            </p>
            """.formatted(profileUrl));

        return EmailLayout.wrap(theme, "📣", subtitle == null ? "" : subtitle, body.toString());
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
