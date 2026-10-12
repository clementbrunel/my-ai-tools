package com.pronocore.service.email.template;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

/** Sent to PLATFORM_ADMINs when the post-race jolpica import has staged a classification
 *  that now waits for their review and validation (nothing is settled until then). */
public final class AdminResultsReadyEmailTemplate {

    private AdminResultsReadyEmailTemplate() {
    }

    public static String subject(Race race) {
        return "🏁 " + race.getName() + " : résultats à valider";
    }

    public static String build(EmailTheme theme, User admin, Race race, String frontendUrl) {
        String displayName = admin.getDisplayName() != null ? admin.getDisplayName() : admin.getUsername();
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Résultats prêts à être validés 🏁</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              Le classement du <strong>%s</strong> vient d'être importé depuis jolpica.
              Il est en <strong>brouillon</strong> : aucun point n'est encore attribué et aucun email n'est parti aux joueurs.
            </p>
            <p style="color:#444;line-height:1.6">
              Relis-le (pole, meilleur tour, lanterne rouge…), corrige si besoin, puis valide pour régler les paris.
            </p>
            <div style="text-align:center;margin:24px 0">
              <a href="%s/admin"
                 style="background:#1E3A5F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
                Vérifier et valider
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Notification automatique — envoyée aux administrateurs de la plateforme.
            </p>
            """.formatted(displayName, race.getName(), frontendUrl);
        return EmailLayout.wrap(theme, "🏁", "Validation des résultats", body);
    }
}
