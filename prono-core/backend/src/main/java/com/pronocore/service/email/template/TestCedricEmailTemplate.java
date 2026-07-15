package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

public final class TestCedricEmailTemplate {

    private TestCedricEmailTemplate() {
    }

    public static final String SUBJECT = "test cédric";

    public static String build(EmailTheme theme) {
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">test cédric 🏦</h2>
            <p style="color:#444;line-height:1.6">
              Bonjour,
            </p>
            <p style="color:#444;line-height:1.6">
              Si tu reçois cet email, <strong>bonne nouvelle : l'envoi de mails fonctionne !</strong>
            </p>
            <div style="background:#fff8e1;border-left:4px solid #FFD700;border-radius:4px;padding:16px;margin:24px 0">
              <p style="margin:0;color:#555;font-size:14px;line-height:1.7">
                💬 <em>Contrairement à notre confrère <strong>Cédric Agricole</strong> qui, le 9 juin 2026,
                a envoyé son "test cédric" à des millions de clients du Crédit Agricole en croyant rester
                dans un environnement de dev… cet email a été déclenché <strong>intentionnellement</strong>
                depuis l'interface d'administration.</em>
              </p>
              <p style="margin:8px 0 0;color:#555;font-size:14px">
                Ici, les tests restent des tests. 😌
              </p>
            </div>
            <p style="color:#888;font-size:14px">
              Ce message confirme que la chaîne d'envoi Resend est opérationnelle. Aucune action n'est requise.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Pronostics entre amis</p>
            """;

        return EmailLayout.wrap(theme, "🏆", "Pronostics entre amis", body);
    }
}
