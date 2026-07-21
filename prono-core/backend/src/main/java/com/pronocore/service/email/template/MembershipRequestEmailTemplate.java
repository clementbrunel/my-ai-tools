package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

public final class MembershipRequestEmailTemplate {

    private MembershipRequestEmailTemplate() {
    }

    public static String subject(String groupName) {
        return "🙋 Nouvelle demande d'adhésion — " + groupName;
    }

    public static String build(EmailTheme theme, String recipientName, String applicantName, String groupName, String frontendUrl) {
        String groupsUrl = frontendUrl + "/groups";

        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Une nouvelle demande d'adhésion attend ta réponse</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              <strong>%s</strong> souhaite rejoindre ton groupe <strong>%s</strong>. En tant que chef de groupe,
              c'est toi qui décides d'accepter ou de refuser cette demande.
            </p>

            <div style="text-align:center;margin:32px 0">
              <a href="%s"
                 style="background:%s;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                🙋 Voir la demande
              </a>
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car tu es chef du groupe <strong>%s</strong>.
            </p>
            """.formatted(recipientName, applicantName, groupName, groupsUrl, theme.gradientEnd(), groupName);

        return EmailLayout.wrap(theme, "🙋", groupName, body);
    }
}
