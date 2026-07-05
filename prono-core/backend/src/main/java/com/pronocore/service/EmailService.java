package com.pronocore.service;

import com.pronocore.dto.request.EmailType;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Match;
import com.pronocore.entity.Team;
import com.pronocore.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class EmailService {

    private static final Competition FIFA_WORLD_CUP_2026 =
            Competition.builder().id(1L).name("FIFA World Cup 2026").build();

    private final RestClient restClient;

    @Value("${resend.api-key}")
    private String apiKey;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public EmailService() {
        this.restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .build();
    }

    public void sendTestEmail(String to, EmailType emailType) {
        switch (emailType) {
            case VERIFICATION -> sendVerificationEmail(to, "test-preview-000");
            case PASSWORD_RESET -> sendPasswordResetEmail(to, "test-preview-000");
            case MATCH_REMINDER -> {
                User fakeUser = User.builder().username("joueur_test").email(to).emailReminderEnabled(true).build();
                List<Match> fakeMatches = List.of(
                    Match.builder().id(0L)
                        .teamA(Team.builder().id(1L).name("France").iso2("fr").build())
                        .teamB(Team.builder().id(2L).name("Brésil").iso2("br").build())
                        .matchDate(LocalDateTime.now().plusHours(1))
                        .competition(FIFA_WORLD_CUP_2026).round("Finale")
                        .reminderSent(false).build(),
                    Match.builder().id(1L)
                        .teamA(Team.builder().id(3L).name("Espagne").iso2("es").build())
                        .teamB(Team.builder().id(4L).name("Allemagne").iso2("de").build())
                        .matchDate(LocalDateTime.now().plusMinutes(65))
                        .competition(FIFA_WORLD_CUP_2026).round("Demi-finale")
                        .reminderSent(false).build()
                );
                sendMatchReminder(fakeUser, fakeMatches);
            }
            case GAGE_RESOLUTION -> {
                User fakeRecipient = User.builder().username("joueur_test").displayName("Joueur Test").email(to).build();
                User fakeLucky = User.builder().username("malheureux").displayName("Le Malchanceux").build();
                Map<String, Integer> fakeScores = Map.of(
                    "Joueur Test", 20,
                    "Le Malchanceux", 5,
                    "Autre Joueur", 15
                );
                sendGageResolutionEmail(fakeRecipient, "Les 10 pompes", "Fais 10 pompes devant tout le groupe", fakeLucky, "Groupe des Amis", fakeScores);
            }
            case GROUP_NEW_MATCHES -> {
                User fakeRecipient = User.builder().username("joueur_test").displayName("Joueur Test").email(to).build();
                User fakeLeader = User.builder().username("chef_test").displayName("Le Chef").build();
                List<Match> fakeNewMatches = List.of(
                    Match.builder().id(0L)
                        .teamA(Team.builder().id(5L).name("Portugal").iso2("pt").build())
                        .teamB(Team.builder().id(6L).name("Argentine").iso2("ar").build())
                        .matchDate(LocalDateTime.now().plusDays(2)).competition(FIFA_WORLD_CUP_2026)
                        .round("Quart de finale").build(),
                    Match.builder().id(1L)
                        .teamA(Team.builder().id(7L).name("Angleterre").iso2("gb-eng").build())
                        .teamB(Team.builder().id(8L).name("Pays-Bas").iso2("nl").build())
                        .matchDate(LocalDateTime.now().plusDays(3)).competition(FIFA_WORLD_CUP_2026)
                        .round("Quart de finale").build()
                );
                sendGroupNewMatchesEmail(fakeRecipient, "Groupe des Amis", fakeLeader, fakeNewMatches);
            }
            case TEST_CEDRIC -> sendTestCedricEmail(to);
        }
    }

    public void sendVerificationEmail(String to, String token) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(to),
                    "subject", "Vérifie ton adresse email - PronoCore",
                    "html", buildVerificationHtml(verifyUrl)
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Verification email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de vérification. Vérifie ta configuration Resend.");
        }
    }

    public void sendPasswordResetEmail(String to, String token) {
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(to),
                    "subject", "Réinitialisation de ton mot de passe - PronoCore",
                    "html", buildPasswordResetHtml(resetUrl)
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Password reset email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de réinitialisation. Vérifie ta configuration Resend.");
        }
    }

    public void sendMatchReminder(User user, List<Match> matches) {
        if (matches.isEmpty()) return;
        String subject = matches.size() == 1
            ? "⚽ Rappel : " + matches.get(0).getTeamA().getName() + " – " + matches.get(0).getTeamB().getName() + " dans 4h !"
            : "⚽ Rappel : " + matches.size() + " matchs à pronostiquer dans 4h !";
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(user.getEmail()),
                    "subject", subject,
                    "html", buildMatchReminderHtml(user, matches)
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Match reminder sent to {} ({} match(es))", user.getEmail(), matches.size());
        } catch (Exception e) {
            log.error("Failed to send match reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    public void sendGageResolutionEmail(User recipient, String forfeitTitle, String forfeitDescription,
                                        User assignedTo, String groupName, Map<String, Integer> dailyScores) {
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String assignedToName = assignedTo.getDisplayName() != null ? assignedTo.getDisplayName() : assignedTo.getUsername();
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(recipient.getEmail()),
                    "subject", "🃏 Gage du jour attribué — " + groupName,
                    "html", buildGageResolutionHtml(displayName, forfeitTitle, forfeitDescription, assignedToName, groupName, dailyScores)
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Gage resolution email sent to {} (group {})", recipient.getEmail(), groupName);
        } catch (Exception e) {
            log.error("Failed to send gage resolution email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    private String buildGageResolutionHtml(String recipientName, String forfeitTitle, String forfeitDescription,
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

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">🃏</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">%s</p>
                </div>
                <div style="padding:32px">
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
                </div>
              </div>
            </body>
            </html>
            """.formatted(groupName, recipientName, scoreRows, assignedToName, forfeitTitle, forfeitDescription);
    }

    public void sendGroupNewMatchesEmail(User recipient, String groupName, User leader, List<Match> matches) {
        if (matches.isEmpty()) return;
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String leaderName = leader.getDisplayName() != null ? leader.getDisplayName() : leader.getUsername();
        String subject = matches.size() == 1
            ? "⚽ Nouveau match ouvert aux pronos — " + groupName
            : "⚽ " + matches.size() + " nouveaux matchs ouverts aux pronos — " + groupName;
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(recipient.getEmail()),
                    "subject", subject,
                    "html", buildGroupNewMatchesHtml(displayName, groupName, leaderName, matches)
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Group new matches email sent to {} (group {}, {} match(es))", recipient.getEmail(), groupName, matches.size());
        } catch (Exception e) {
            log.error("Failed to send group new matches email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    private String buildGroupNewMatchesHtml(String recipientName, String groupName, String leaderName, List<Match> matches) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("EEE dd/MM 'à' HH'h'mm", Locale.FRANCE);

        String matchRows = matches.stream().map(m -> """
                <tr style="background:#f8f9fa">
                  <td style="padding:10px 14px;font-weight:bold;color:#1a1a1a">%s – %s</td>
                  <td style="padding:10px 14px;color:#555">%s</td>
                  <td style="padding:10px 14px;color:#6b7280;font-size:13px">%s</td>
                </tr>
                """.formatted(m.getTeamA(), m.getTeamB(), m.getRound(), m.getMatchDate().format(fmt))
        ).collect(Collectors.joining());

        String appUrl = frontendUrl + "/matches";

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">⚽</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">%s</p>
                </div>
                <div style="padding:32px">
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
                </div>
              </div>
            </body>
            </html>
            """.formatted(groupName, recipientName, leaderName, matchRows, appUrl);
    }

    public void sendTestCedricEmail(String to) {
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "from", "PronoCore <noreply@app.prono-core.top>",
                    "to", List.of(to),
                    "subject", "test cédric",
                    "html", buildTestCedricHtml()
                ))
                .retrieve()
                .toBodilessEntity();
            log.info("Test Cédric email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send Test Cédric email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de test. Vérifie ta configuration Resend.");
        }
    }

    private String buildTestCedricHtml() {
        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">🏆</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">Coupe du Monde 2026</p>
                </div>
                <div style="padding:32px">
                  <h2 style="color:#1a1a1a;margin-top:0">test cédric 🏦</h2>
                  <p style="color:#444;line-height:1.6">
                    Bonjour,
                  </p>
                  <p style="color:#444;line-height:1.6">
                    Si tu reçois cet email, <strong>bonne nouvelle : l'envoi de mails fonctionne !</strong>
                  </p>
                  <div style="background:#fff8e1;border-left:4px solid #FFD700;border-radius:4px;padding:16px;margin:24px 0">
                    <p style="margin:0;color:#555;font-size:14px;line-height:1.7">
                      💬 <em>Contrairement à notre confrère <strong>Cédric Agricole</strong> qui, le 9 juin 2026,
                      a envoyé son "test cédric" à des millions de clients du Crédit Agricole en croyant rester
                      dans un environnement de dev… cet email a été déclenché <strong>intentionnellement</strong>
                      depuis l'interface d'administration.</em>
                    </p>
                    <p style="margin:8px 0 0;color:#555;font-size:14px">
                      Ici, les tests restent des tests. 😌
                    </p>
                  </div>
                  <p style="color:#888;font-size:14px">
                    Ce message confirme que la chaîne d'envoi Resend est opérationnelle. Aucune action n'est requise.
                  </p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                  <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Le meilleur pronostiqueur remporte la coupe ⚽</p>
                </div>
              </div>
            </body>
            </html>
            """;
    }

    private String buildMatchReminderHtml(User user, List<Match> matches) {
        String displayName = user.getDisplayName() != null ? user.getDisplayName() : user.getUsername();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH'h'mm", Locale.FRANCE);

        String matchCards = matches.stream().map(m -> {
            String appUrl = frontendUrl + "/matches/" + m.getId();
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
                              m.getMatchDate().format(fmt), m.getRound(),
                              appUrl);
        }).collect(Collectors.joining());

        String intro = matches.size() == 1
            ? "Le match suivant commence dans <strong>4 heures</strong> et tu n'as pas encore saisi ton pronostic !"
            : "Les <strong>" + matches.size() + " matchs</strong> suivants commencent dans <strong>4 heures</strong> et tu n'as encore saisi aucun pronostic !";

        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">⚽</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">Coupe du Monde 2026</p>
                </div>
                <div style="padding:32px">
                  <h2 style="color:#1a1a1a;margin-top:0">Rappel de match ⏰</h2>
                  <p style="color:#444;line-height:1.6">Bonjour <strong>%s</strong>,</p>
                  <p style="color:#444;line-height:1.6">%s</p>
                  %s
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                  <p style="color:#aaa;font-size:12px;text-align:center">
                    Tu reçois cet email car les rappels de matchs sont activés dans ton profil.<br>
                    Pour les désactiver : <em>Mon profil → Notifications</em>.
                  </p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(displayName, intro, matchCards);
    }

    private String buildPasswordResetHtml(String resetUrl) {
        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">🏆</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">Coupe du Monde 2026</p>
                </div>
                <div style="padding:32px">
                  <h2 style="color:#1a1a1a;margin-top:0">Réinitialisation de ton mot de passe 🔒</h2>
                  <p style="color:#444;line-height:1.6">Tu as demandé à réinitialiser ton mot de passe sur PronoCore. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="%s"
                       style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                      🔒 Réinitialiser mon mot de passe
                    </a>
                  </div>
                  <p style="color:#888;font-size:14px">Ce lien est valable <strong>1 heure</strong>. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe restera inchangé.</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                  <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Le meilleur pronostiqueur remporte la coupe ⚽</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(resetUrl);
    }

    private String buildVerificationHtml(String verifyUrl) {
        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="utf-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
                <div style="background:linear-gradient(135deg,#1a472a,#2d6a4f);padding:32px;text-align:center">
                  <div style="font-size:48px;margin-bottom:8px">🏆</div>
                  <h1 style="color:#FFD700;margin:0;font-size:28px">PronoCore</h1>
                  <p style="color:#90EE90;margin:8px 0 0">Coupe du Monde 2026</p>
                </div>
                <div style="padding:32px">
                  <h2 style="color:#1a1a1a;margin-top:0">Vérifie ton adresse email ✅</h2>
                  <p style="color:#444;line-height:1.6">Merci de t'être inscrit sur PronoCore ! Pour activer ton compte et rejoindre les pronos, clique sur le bouton ci-dessous.</p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="%s"
                       style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                      ✅ Vérifier mon email
                    </a>
                  </div>
                  <p style="color:#888;font-size:14px">Ce lien est valable <strong>24 heures</strong>. Si tu n'as pas créé de compte sur PronoCore, ignore cet email.</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                  <p style="color:#aaa;font-size:12px;text-align:center">PronoCore — Le meilleur pronostiqueur remporte la coupe ⚽</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(verifyUrl);
    }
}
