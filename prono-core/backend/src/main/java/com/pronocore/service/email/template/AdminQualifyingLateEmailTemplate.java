package com.pronocore.service.email.template;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Sent once to PLATFORM_ADMINs when jolpica still has no starting grid several hours after
 *  qualifying — the grid has to be typed in by hand for players to see it before the race. */
public final class AdminQualifyingLateEmailTemplate {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM à HH'h'mm", Locale.FRANCE);

    private AdminQualifyingLateEmailTemplate() {
    }

    public static String subject(Race race) {
        return "⚠️ " + race.getName() + " : grille de départ toujours absente de jolpica";
    }

    public static String build(EmailTheme theme, User admin, Race race, String frontendUrl) {
        String displayName = admin.getDisplayName() != null ? admin.getDisplayName() : admin.getUsername();
        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Grille de départ à saisir à la main ⚠️</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              Les qualifs du <strong>%s</strong> sont terminées depuis plusieurs heures, mais jolpica
              n'a toujours pas publié la grille de départ. Les joueurs n'ont donc aucune grille.
            </p>
            <p style="color:#444;line-height:1.6">
              Tu peux la saisir toi-même dans l'onglet ⏱ Qualifs (départ prévu le <strong>%s</strong>).
              L'import automatique continue en attendant et te préviendra si jolpica la publie.
            </p>
            <div style="text-align:center;margin:24px 0">
              <a href="%s/admin"
                 style="background:#1E3A5F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
                Saisir la grille
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Notification automatique — envoyée une seule fois aux administrateurs de la plateforme.
            </p>
            """.formatted(displayName, race.getName(), race.getRaceDate().format(DATE_FORMAT), frontendUrl);
        return EmailLayout.wrap(theme, "⚠️", "Grille de départ manquante", body);
    }
}
