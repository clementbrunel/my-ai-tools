package com.pronocore.service.email.template;

import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class GageResolutionEmailTemplate {

    private GageResolutionEmailTemplate() {
    }

    public static String subject(String groupName) {
        return "🃏 Gage du jour attribué — " + groupName;
    }

    public static String build(EmailTheme theme, String recipientName, String forfeitTitle, String forfeitDescription,
                                String assignedToName, String groupName, Map<String, Integer> dailyScores) {
        List<Map.Entry<String, Integer>> sorted = dailyScores.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .toList();

        String scoreRows = sorted.stream().map(e -> {
            boolean isLoser = e.getKey().equals(assignedToName);
            String rowStyle = isLoser
                ? "background:#fff0f0;border-left:3px solid #e53e3e;"
                : "background:#f8f9fa;";
            String badge = isLoser ? " 🃏" : "";
            return """
                <tr style="%s">
                  <td style="padding:10px 14px;font-weight:%s;color:#1a1a1a">%s%s</td>
                  <td style="padding:10px 14px;text-align:right;font-weight:bold;color:%s">%d pts</td>
                </tr>
                """.formatted(rowStyle, isLoser ? "bold" : "normal", e.getKey(), badge,
                              isLoser ? "#e53e3e" : "#1a472a", e.getValue());
        }).collect(Collectors.joining());

        String body = """
            <h2 style="color:#1a1a1a;margin-top:0">Le gage du jour est attribué !</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              La journée de matchs est terminée. Voici le bilan des pronostics et l'attribution du gage du jour.
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

            <div style="background:#fff0f0;border:2px solid #e53e3e;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
              <div style="font-size:32px;margin-bottom:8px">🃏</div>
              <p style="margin:0 0 4px;color:#e53e3e;font-weight:bold;font-size:18px">%s écope du gage !</p>
              <p style="margin:0;color:#888;font-size:13px">Score le plus faible de la journée</p>
            </div>

            <div style="background:#f8f9fa;border-left:4px solid #FFD700;border-radius:4px;padding:16px;margin-bottom:24px">
              <p style="margin:0 0 4px;font-weight:bold;color:#1a1a1a">%s</p>
              <p style="margin:0;color:#555;font-size:14px;line-height:1.6">%s</p>
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Tu reçois cet email car les notifications de gage sont activées dans ton profil.<br>
              Pour les désactiver : <em>Mon profil → Notifications</em>.
            </p>
            """.formatted(recipientName, scoreRows, assignedToName, forfeitTitle, forfeitDescription);

        return EmailLayout.wrap(theme, "🃏", groupName, body);
    }
}
