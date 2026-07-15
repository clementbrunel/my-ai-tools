package com.pronocore.service.email.template;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class RaceReminderEmailTemplate {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH'h'mm", Locale.FRANCE);

    private RaceReminderEmailTemplate() {
    }

    public static String subject(List<Race> races) {
        return races.size() == 1
            ? "🏁 Rappel : " + races.get(0).getName() + " dans 4h !"
            : "🏁 Rappel : " + races.size() + " courses à pronostiquer dans 4h !";
    }

    public static String build(EmailTheme theme, User user, List<Race> races, String frontendUrl) {
        String displayName = user.getDisplayName() != null ? user.getDisplayName() : user.getUsername();

        String raceCards = races.stream().map(r -> {
            String appUrl = frontendUrl + "/f1/races/" + r.getId();
            return """
                <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:12px 0;display:flex;align-items:center;justify-content:space-between">
                  <div>
                    <div style="font-size:16px;font-weight:bold;color:#1a1a1a">%s</div>
                    <div style="color:#6b7280;font-size:13px;margin-top:2px">%s • %s</div>
                  </div>
                  <a href="%s"
                     style="background:#9B0400;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;white-space:nowrap;margin-left:16px">
                    🏁 Parier
                  </a>
                </div>
                """.formatted(r.getName(), r.getRaceDate().format(TIME_FORMAT), r.getCircuit(), appUrl);
        }).collect(Collectors.joining());

        String intro = races.size() == 1
            ? "La course suivante commence dans <strong>4 heures</strong> et tu n'as pas encore saisi ton pronostic !"
            : "Les <strong>" + races.size() + " courses</strong> suivantes commencent dans <strong>4 heures</strong> et tu n'as encore saisi aucun pronostic !";

        String bodyBase = """
            <h2 style="color:#1a1a1a;margin-top:0">Rappel de course ⏰</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">%s</p>
            %s
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car les rappels avant chaque pari sont activés dans ton profil.<br>
              Pour les désactiver : <em>Mon profil → Notifications</em>.
            </p>
            """.formatted(displayName, intro, raceCards);

        return EmailLayout.wrap(theme, "🏁", "Formule 1", bodyBase);
    }
}
