package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Scores-only counterpart to {@link GageResolutionEmailTemplate}, used by groups that
 * have disabled the daily gage mechanic — same score table, no loser/gage section.
 */
public final class DailyScoresEmailTemplate {

    private DailyScoresEmailTemplate() {
    }

    public static String subject(String groupName) {
        return "📊 Scores du jour — " + groupName;
    }

    public static String build(EmailTheme theme, String recipientName, String groupName,
                                Map<String, Integer> dailyScores, String dayLabel) {
        List<Map.Entry<String, Integer>> sorted = dailyScores.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .toList();

        String scoreRows = sorted.stream().map(e -> """
                <tr style="background:#f8f9fa">
                  <td style="padding:10px 14px;font-weight:normal;color:#1a1a1a">%s</td>
                  <td style="padding:10px 14px;text-align:right;font-weight:bold;color:#1a472a">%d pts</td>
                </tr>
                """.formatted(e.getKey(), e.getValue())
        ).collect(Collectors.joining());

        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Les scores du jour sont tombés !</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              La journée %s est terminée. Voici le bilan des pronostics.
            </p>

            <h3 style="color:#1a472a;margin-bottom:8px">📊 Paris du jour</h3>
            <table style="width:100%%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:24px">
              <thead>
                <tr style="background:#1a472a">
                  <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px">Joueur</th>
                  <th style="padding:10px 14px;text-align:right;color:#fff;font-size:13px">Points gagnés</th>
                </tr>
              </thead>
              <tbody>
                %s
              </tbody>
            </table>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Les gages sont désactivés dans ce groupe.<br>
              Tu reçois cet email car les notifications de gage sont activées dans ton profil.<br>
              Pour les désactiver : <em>Mon profil → Notifications</em>.
            </p>
            """.formatted(recipientName, dayLabel, scoreRows);

        return EmailLayout.wrap(theme, "📊", groupName, body);
    }
}
