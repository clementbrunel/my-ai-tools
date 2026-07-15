package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

public final class PasswordResetEmailTemplate {

    private PasswordResetEmailTemplate() {
    }

    public static final String SUBJECT = "Réinitialisation de ton mot de passe - PronoCore";

    public static String build(EmailTheme theme, String resetUrl) {
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Réinitialisation de ton mot de passe 🔒</h2>
            <p style="color:#444;line-height:1.6">Tu as demandé à réinitialiser ton mot de passe sur PronoCore. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="%s"
                 style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                🔒 Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color:#888;font-size:14px">Ce lien est valable <strong>1 heure</strong>. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe restera inchangé.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Pronostics entre amis</p>
            """.formatted(resetUrl);

        return EmailLayout.wrap(theme, "🏆", "Pronostics entre amis", body);
    }
}
