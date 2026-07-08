package com.pronocore.service.email.template;

import com.pronocore.entity.Match;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class MatchReminderEmailTemplate {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH'h'mm", Locale.FRANCE);

    private MatchReminderEmailTemplate() {
    }

    public static String subject(List<Match> matches) {
        return matches.size() == 1
            ? "⚽ Rappel : " + matches.get(0).getTeamA().getName() + " – " + matches.get(0).getTeamB().getName() + " dans 4h !"
            : "⚽ Rappel : " + matches.size() + " matchs à pronostiquer dans 4h !";
    }

    public static String build(EmailTheme theme, User user, List<Match> matches, String frontendUrl) {
        String displayName = user.getDisplayName() != null ? user.getDisplayName() : user.getUsername();

        String matchCards = matches.stream().map(m -> {
            String appUrl = frontendUrl + "/foot/matches/" + m.getId();
            return """
                <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:12px 0;display:flex;align-items:center;justify-content:space-between">
                  <div>
                    <div style="font-size:16px;font-weight:bold;color:#1a472a">%s – %s</div>
                    <div style="color:#6b7280;font-size:13px;margin-top:2px">%s • %s</div>
                  </div>
                  <a href="%s"
                     style="background:#2d6a4f;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;white-space:nowrap;margin-left:16px">
                    ⚽ Parier
                  </a>
                </div>
                """.formatted(m.getTeamA().getName(), m.getTeamB().getName(),
                              m.getMatchDate().format(TIME_FORMAT), m.getRound(),
                              appUrl);
        }).collect(Collectors.joining());

        String intro = matches.size() == 1
            ? "Le match suivant commence dans <strong>4 heures</strong> et tu n'as pas encore saisi ton pronostic !"
            : "Les <strong>" + matches.size() + " matchs</strong> suivants commencent dans <strong>4 heures</strong> et tu n'as encore saisi aucun pronostic !";

        String bodyBase = """
            <h2 style="color:#1a1a1a;margin-top:0">Rappel de match ⏰</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">%s</p>
            %s
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car les rappels de matchs sont activés dans ton profil.<br>
              Pour les désactiver : <em>Mon profil → Notifications</em>.
            </p>
            """.formatted(displayName, intro, matchCards);

        return EmailLayout.wrap(theme, "⚽", "Coupe du Monde 2026", bodyBase);
    }
}
