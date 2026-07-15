package com.pronocore.service.email.template;

import com.pronocore.entity.Race;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** F1 twin of {@link GroupNewMatchesEmailTemplate} — notifies group members that Grands Prix opened for predictions. */
public final class GroupNewRacesEmailTemplate {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("EEE dd/MM 'à' HH'h'mm", Locale.FRANCE);

    private GroupNewRacesEmailTemplate() {
    }

    public static String subject(String groupName, List<Race> races) {
        return races.size() == 1
            ? "🏎 Nouveau Grand Prix ouvert aux pronos — " + groupName
            : "🏎 " + races.size() + " nouveaux Grands Prix ouverts aux pronos — " + groupName;
    }

    public static String build(EmailTheme theme, String recipientName, String groupName, String leaderName,
                                List<Race> races, String frontendUrl) {
        String raceRows = races.stream().map(r -> """
                <tr style="background:#f8f9fa">
                  <td style="padding:10px 14px;font-weight:bold;color:#1a1a1a">%s</td>
                  <td style="padding:10px 14px;color:#555">Manche %d</td>
                  <td style="padding:10px 14px;color:#6b7280;font-size:13px">%s</td>
                </tr>
                """.formatted(r.getName(), r.getRound(), r.getRaceDate().format(DATE_FORMAT))
        ).collect(Collectors.joining());

        String appUrl = frontendUrl + "/f1/races";

        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">De nouveaux Grands Prix sont ouverts aux pronos !</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              <strong>%s</strong>, chef de votre groupe, vient d'ouvrir les Grands Prix suivants aux pronostics.
              Pense à saisir ton podium avant les qualifs !
            </p>

            <table style="width:100%%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin:20px 0">
              <thead>
                <tr style="background:#9B0400">
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Grand Prix</th>
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Manche</th>
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Départ</th>
                </tr>
              </thead>
              <tbody>
                %s
              </tbody>
            </table>

            <div style="text-align:center;margin:32px 0">
              <a href="%s"
                 style="background:#E10600;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                🏎 Voir les courses
              </a>
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car le chef de ton groupe a notifié l'ouverture de nouveaux Grands Prix.
            </p>
            """.formatted(recipientName, leaderName, raceRows, appUrl);

        return EmailLayout.wrap(theme, "🏎", groupName, body);
    }
}
