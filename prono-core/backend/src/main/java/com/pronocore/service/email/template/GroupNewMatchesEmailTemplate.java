package com.pronocore.service.email.template;

import com.pronocore.entity.Match;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public final class GroupNewMatchesEmailTemplate {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("EEE dd/MM 'à' HH'h'mm", Locale.FRANCE);

    private GroupNewMatchesEmailTemplate() {
    }

    public static String subject(String groupName, List<Match> matches) {
        return matches.size() == 1
            ? "⚽ Nouveau match ouvert aux pronos — " + groupName
            : "⚽ " + matches.size() + " nouveaux matchs ouverts aux pronos — " + groupName;
    }

    public static String build(EmailTheme theme, String recipientName, String groupName, String leaderName,
                                List<Match> matches, String frontendUrl) {
        String matchRows = matches.stream().map(m -> """
                <tr style="background:#f8f9fa">
                  <td style="padding:10px 14px;font-weight:bold;color:#1a1a1a">%s – %s</td>
                  <td style="padding:10px 14px;color:#555">%s</td>
                  <td style="padding:10px 14px;color:#6b7280;font-size:13px">%s</td>
                </tr>
                """.formatted(m.getTeamA().getName(), m.getTeamB().getName(), m.getRound(), m.getMatchDate().format(DATE_FORMAT))
        ).collect(Collectors.joining());

        String appUrl = frontendUrl + "/foot/matches";

        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">De nouveaux matchs sont ouverts aux pronos !</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              <strong>%s</strong>, chef de votre groupe, vient d'ouvrir les matchs suivants aux pronostics.
              Pense à saisir tes prédictions avant le coup d'envoi !
            </p>

            <table style="width:100%%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin:20px 0">
              <thead>
                <tr style="background:#1a472a">
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Match</th>
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Tour</th>
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Coup d'envoi</th>
                </tr>
              </thead>
              <tbody>
                %s
              </tbody>
            </table>

            <div style="text-align:center;margin:32px 0">
              <a href="%s"
                 style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                ⚽ Voir les matchs
              </a>
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car le chef de ton groupe a notifié l'ajout de nouveaux matchs.
            </p>
            """.formatted(recipientName, leaderName, matchRows, appUrl);

        return EmailLayout.wrap(theme, "⚽", groupName, body);
    }
}
