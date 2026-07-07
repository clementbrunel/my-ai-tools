package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

public final class VerificationEmailTemplate {

    private VerificationEmailTemplate() {
    }

    public static final String SUBJECT = "Vérifie ton adresse email - PronoCore";

    public static String build(EmailTheme theme, String verifyUrl) {
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Vérifie ton adresse email ✅</h2>
            <p style="color:#444;line-height:1.6">Merci de t'être inscrit sur PronoCore ! Pour activer ton compte et rejoindre les pronos, clique sur le bouton ci-dessous.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="%s"
                 style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                ✅ Vérifier mon email
              </a>
            </div>
            <p style="color:#888;font-size:14px">Ce lien est valable <strong>24 heures</strong>. Si tu n'as pas créé de compte sur PronoCore, ignore cet email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Le meilleur pronostiqueur remporte la coupe ⚽</p>
            """.formatted(verifyUrl);

        return EmailLayout.wrap(theme, "🏆", "Coupe du Monde 2026", body);
    }
}
