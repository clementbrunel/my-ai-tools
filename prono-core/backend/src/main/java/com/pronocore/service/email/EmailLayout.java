package com.pronocore.service.email;

/**
 * Shared HTML shell (header gradient + card + footer) that every email
 * template renders its content into. Extracted because all six templates
 * used to duplicate this markup with only the colors differing.
 */
public final class EmailLayout {

    private EmailLayout() {
    }

    public static String wrap(EmailTheme theme, String headerEmoji, String subtitle, String bodyHtml) {
        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,%s,%s);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">%s</div>
                  <h1 style="color:%s;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:%s;margin:8px 0 0">%s</p>
                </div>
                <div style="padding:32px">
                  %s
                </div>
              </div>
            </body>
            </html>
            """.formatted(theme.gradientStart(), theme.gradientEnd(), headerEmoji,
                          theme.accentColor(), theme.subtitleColor(), subtitle, bodyHtml);
    }
}
