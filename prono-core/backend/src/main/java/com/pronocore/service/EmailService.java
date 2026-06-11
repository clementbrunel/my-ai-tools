package com.pronocore.service;

import com.pronocore.dto.request.EmailType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class EmailService {

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
                    "html", buildHtml(verifyUrl)
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

    private String buildHtml(String verifyUrl) {
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
