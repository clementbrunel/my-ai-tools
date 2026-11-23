package com.pronocore.service.email.template;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

/** Sent to PLATFORM_ADMINs when the post-qualifying jolpica import has staged a starting grid
 *  that now waits for their review — players don't see it until it's validated. */
public final class AdminQualifyingReadyEmailTemplate {

    private AdminQualifyingReadyEmailTemplate() {
    }

    public static String subject(Race race) {
        return "⏱ " + race.getName() + " : grille de départ à valider";
    }

    public static String build(EmailTheme theme, User admin, Race race, String frontendUrl) {
        String displayName = admin.getDisplayName() != null ? admin.getDisplayName() : admin.getUsername();
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Grille de départ prête à être validée ⏱</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              La grille de départ du <strong>%s</strong> vient d'être importée depuis jolpica.
              Elle est en <strong>brouillon</strong> : les joueurs ne la voient pas encore.
            </p>
            <p style="color:#444;line-height:1.6">
              Vérifie-la (pénalités de grille…), corrige si besoin, puis valide-la dans l'onglet ⏱ Qualifs
              pour la publier avant le départ.
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
        return EmailLayout.wrap(theme, "⏱", "Validation de la grille", body);
    }
}
