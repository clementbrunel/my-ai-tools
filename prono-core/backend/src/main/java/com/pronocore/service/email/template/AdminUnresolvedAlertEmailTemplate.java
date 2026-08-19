package com.pronocore.service.email.template;

import com.pronocore.entity.DailyGage;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailLayout;
import com.pronocore.service.email.EmailTheme;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Daily digest sent to every PLATFORM_ADMIN listing matches/races/gages stuck past their
 *  auto-resolution deadline — the platform's early-warning for a sync or settlement that
 *  silently failed instead of erroring loudly. */
public final class AdminUnresolvedAlertEmailTemplate {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM HH'h'mm", Locale.FRANCE);

    private AdminUnresolvedAlertEmailTemplate() {
    }

    public static String subject(int totalCount) {
        return "⚠️ " + totalCount + " anomalie" + (totalCount > 1 ? "s" : "") + " de résolution automatique";
    }

    public static String build(EmailTheme theme, User admin, List<Match> overdueMatches,
                                List<Race> overdueRaces, List<DailyGage> overdueGages, String frontendUrl) {
        String displayName = admin.getDisplayName() != null ? admin.getDisplayName() : admin.getUsername();
        LocalDateTime now = LocalDateTime.now();

        String matchSection = overdueMatches.isEmpty() ? "" : section("⚽ Matchs non résolus", overdueMatches.stream().map(m ->
            row(m.getTeamA().getName() + " – " + m.getTeamB().getName(),
                m.getCompetition().getName() + " • " + m.getRound(),
                m.getMatchDate().format(DATE_FORMAT), hoursLate(m.getMatchDate(), now),
                frontendUrl + "/admin/matches")
        ).collect(Collectors.joining()));

        String raceSection = overdueRaces.isEmpty() ? "" : section("🏁 Courses non résolues", overdueRaces.stream().map(r ->
            row(r.getName(), r.getCompetition().getName(),
                r.getRaceDate().format(DATE_FORMAT), hoursLate(r.getRaceDate(), now),
                frontendUrl + "/admin/races")
        ).collect(Collectors.joining()));

        String gageSection = overdueGages.isEmpty() ? "" : section("🎲 Gages non réglés", overdueGages.stream().map(g ->
            row(g.getGroup().getName(), "Journée du " + g.getMatchDate(),
                g.getMatchDate().atStartOfDay().format(DATE_FORMAT), hoursLate(g.getMatchDate().atStartOfDay(), now),
                frontendUrl + "/admin/gages")
        ).collect(Collectors.joining()));

        String bodyBase = """
            <h2 style="color:#1a1a1a;margin-top:0">Anomalies de résolution automatique ⚠️</h2>
            <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
            <p style="color:#444;line-height:1.6">
              Les éléments suivants sont toujours en attente de résolution alors que leur échéance
              est dépassée depuis un moment — vérifie s'il s'agit d'un problème technique
              (sync API, saisie manquante) ou d'un simple retard.
            </p>
            %s%s%s
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px;text-align:center">
              Digest quotidien automatique — envoyé aux administrateurs de la plateforme.
            </p>
            """.formatted(displayName, matchSection, raceSection, gageSection);

        return EmailLayout.wrap(theme, "⚠️", "Digest administrateur", bodyBase);
    }

    private static String section(String title, String rows) {
        return """
            <h3 style="color:#1a1a1a;margin:24px 0 8px">%s</h3>
            %s
            """.formatted(title, rows);
    }

    private static String row(String title, String subtitle, String when, String hoursLate, String appUrl) {
        return """
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:8px 0;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:15px;font-weight:bold;color:#1a1a1a">%s</div>
                <div style="color:#6b7280;font-size:13px;margin-top:2px">%s • %s • en retard de %s</div>
              </div>
              <a href="%s"
                 style="background:#1E3A5F;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;white-space:nowrap;margin-left:16px">
                Vérifier
              </a>
            </div>
            """.formatted(title, subtitle, when, hoursLate, appUrl);
    }

    private static String hoursLate(LocalDateTime deadline, LocalDateTime now) {
        long hours = Duration.between(deadline, now).toHours();
        return hours < 24 ? hours + "h" : (hours / 24) + "j" + (hours % 24) + "h";
    }
}
