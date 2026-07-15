package com.pronocore.service;

import com.pronocore.dto.request.EmailThemeName;
import com.pronocore.dto.request.EmailType;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.Team;
import com.pronocore.entity.User;
import com.pronocore.service.email.EmailSender;
import com.pronocore.service.email.EmailTheme;
import com.pronocore.service.email.template.GageResolutionEmailTemplate;
import com.pronocore.service.email.template.GroupNewMatchesEmailTemplate;
import com.pronocore.service.email.template.GroupNewRacesEmailTemplate;
import com.pronocore.service.email.template.MatchReminderEmailTemplate;
import com.pronocore.service.email.template.PasswordResetEmailTemplate;
import com.pronocore.service.email.template.RaceReminderEmailTemplate;
import com.pronocore.service.email.template.TestCedricEmailTemplate;
import com.pronocore.service.email.template.VerificationEmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private static final Competition FIFA_WORLD_CUP_2026 =
            Competition.builder().id(1L).name("FIFA World Cup 2026").build();

    private static final Competition F1_CHAMPIONSHIP_2026 =
            Competition.builder().id(2L).name("Championnat du monde F1 2026").sport(com.pronocore.entity.Sport.F1).build();

    private final EmailSender emailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public void sendTestEmail(String to, EmailType emailType, EmailThemeName themeName) {
        EmailTheme theme = themeName == EmailThemeName.F1 ? EmailTheme.F1 : EmailTheme.FOOTBALL;
        switch (emailType) {
            case VERIFICATION -> sendVerificationEmail(to, "test-preview-000", theme);
            case PASSWORD_RESET -> sendPasswordResetEmail(to, "test-preview-000", theme);
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
                sendMatchReminder(fakeUser, fakeMatches, theme);
            }
            case RACE_REMINDER -> {
                User fakeUser = User.builder().username("joueur_test").email(to).emailReminderEnabled(true).build();
                List<Race> fakeRaces = List.of(
                    Race.builder().id(0L).name("Grand Prix de Monaco").circuit("Circuit de Monaco")
                        .round(7).qualifyingDate(LocalDateTime.now().plusMinutes(65))
                        .raceDate(LocalDateTime.now().plusHours(1))
                        .competition(F1_CHAMPIONSHIP_2026).reminderSent(false).build()
                );
                emailSender.send(to, RaceReminderEmailTemplate.subject(fakeRaces),
                    RaceReminderEmailTemplate.build(EmailTheme.F1, fakeUser, fakeRaces, frontendUrl));
            }
            case GAGE_RESOLUTION -> {
                User fakeRecipient = User.builder().username("joueur_test").displayName("Joueur Test").email(to).build();
                User fakeLucky = User.builder().username("malheureux").displayName("Le Malchanceux").build();
                Map<String, Integer> fakeScores = Map.of(
                    "Joueur Test", 20,
                    "Le Malchanceux", 5,
                    "Autre Joueur", 15
                );
                sendGageResolutionEmail(fakeRecipient, "Les 10 pompes", "Fais 10 pompes devant tout le groupe", fakeLucky, "Groupe des Amis", fakeScores, theme);
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
                sendGroupNewMatchesEmail(fakeRecipient, "Groupe des Amis", fakeLeader, fakeNewMatches, theme);
            }
            case GROUP_NEW_RACES -> {
                User fakeRecipient = User.builder().username("joueur_test").displayName("Joueur Test").email(to).build();
                User fakeLeader = User.builder().username("chef_test").displayName("Le Chef").build();
                Competition f1Championship = Competition.builder().id(2L).name("Formule 1 2026").build();
                List<Race> fakeNewRaces = List.of(
                    Race.builder().id(0L).name("Grand Prix de Monaco").round(8)
                        .raceDate(LocalDateTime.now().plusDays(5)).competition(f1Championship).build(),
                    Race.builder().id(1L).name("Grand Prix du Canada").round(9)
                        .raceDate(LocalDateTime.now().plusDays(12)).competition(f1Championship).build()
                );
                sendGroupNewRacesEmail(fakeRecipient, "Groupe des Amis", fakeLeader, fakeNewRaces);
            }
            case TEST_CEDRIC -> sendTestCedricEmail(to, theme);
        }
    }

    public void sendVerificationEmail(String to, String token) {
        sendVerificationEmail(to, token, EmailTheme.FOOTBALL);
    }

    private void sendVerificationEmail(String to, String token, EmailTheme theme) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        try {
            emailSender.send(to, VerificationEmailTemplate.SUBJECT, VerificationEmailTemplate.build(theme, verifyUrl));
            log.info("Verification email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de vérification. Vérifie ta configuration Resend.");
        }
    }

    public void sendPasswordResetEmail(String to, String token) {
        sendPasswordResetEmail(to, token, EmailTheme.FOOTBALL);
    }

    private void sendPasswordResetEmail(String to, String token, EmailTheme theme) {
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        try {
            emailSender.send(to, PasswordResetEmailTemplate.SUBJECT, PasswordResetEmailTemplate.build(theme, resetUrl));
            log.info("Password reset email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de réinitialisation. Vérifie ta configuration Resend.");
        }
    }

    public void sendMatchReminder(User user, List<Match> matches) {
        sendMatchReminder(user, matches, EmailTheme.FOOTBALL);
    }

    private void sendMatchReminder(User user, List<Match> matches, EmailTheme theme) {
        if (matches.isEmpty()) return;
        try {
            emailSender.send(user.getEmail(), MatchReminderEmailTemplate.subject(matches),
                MatchReminderEmailTemplate.build(theme, user, matches, frontendUrl));
            log.info("Match reminder sent to {} ({} match(es))", user.getEmail(), matches.size());
        } catch (Exception e) {
            log.error("Failed to send match reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    public void sendRaceReminder(User user, List<Race> races) {
        if (races.isEmpty()) return;
        try {
            emailSender.send(user.getEmail(), RaceReminderEmailTemplate.subject(races),
                RaceReminderEmailTemplate.build(EmailTheme.F1, user, races, frontendUrl));
            log.info("Race reminder sent to {} ({} race(s))", user.getEmail(), races.size());
        } catch (Exception e) {
            log.error("Failed to send race reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    public void sendGageResolutionEmail(User recipient, String forfeitTitle, String forfeitDescription,
                                        User assignedTo, String groupName, Map<String, Integer> dailyScores) {
        sendGageResolutionEmail(recipient, forfeitTitle, forfeitDescription, assignedTo, groupName, dailyScores, EmailTheme.FOOTBALL);
    }

    private void sendGageResolutionEmail(User recipient, String forfeitTitle, String forfeitDescription,
                                         User assignedTo, String groupName, Map<String, Integer> dailyScores, EmailTheme theme) {
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String assignedToName = assignedTo.getDisplayName() != null ? assignedTo.getDisplayName() : assignedTo.getUsername();
        try {
            emailSender.send(recipient.getEmail(), GageResolutionEmailTemplate.subject(groupName),
                GageResolutionEmailTemplate.build(theme, displayName, forfeitTitle, forfeitDescription, assignedToName, groupName, dailyScores));
            log.info("Gage resolution email sent to {} (group {})", recipient.getEmail(), groupName);
        } catch (Exception e) {
            log.error("Failed to send gage resolution email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendGroupNewMatchesEmail(User recipient, String groupName, User leader, List<Match> matches) {
        sendGroupNewMatchesEmail(recipient, groupName, leader, matches, EmailTheme.FOOTBALL);
    }

    private void sendGroupNewMatchesEmail(User recipient, String groupName, User leader, List<Match> matches, EmailTheme theme) {
        if (matches.isEmpty()) return;
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String leaderName = leader.getDisplayName() != null ? leader.getDisplayName() : leader.getUsername();
        try {
            emailSender.send(recipient.getEmail(), GroupNewMatchesEmailTemplate.subject(groupName, matches),
                GroupNewMatchesEmailTemplate.build(theme, displayName, groupName, leaderName, matches, frontendUrl));
            log.info("Group new matches email sent to {} (group {}, {} match(es))", recipient.getEmail(), groupName, matches.size());
        } catch (Exception e) {
            log.error("Failed to send group new matches email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendGroupNewRacesEmail(User recipient, String groupName, User leader, List<Race> races) {
        if (races.isEmpty()) return;
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String leaderName = leader.getDisplayName() != null ? leader.getDisplayName() : leader.getUsername();
        try {
            emailSender.send(recipient.getEmail(), GroupNewRacesEmailTemplate.subject(groupName, races),
                GroupNewRacesEmailTemplate.build(EmailTheme.F1, displayName, groupName, leaderName, races, frontendUrl));
            log.info("Group new races email sent to {} (group {}, {} race(s))", recipient.getEmail(), groupName, races.size());
        } catch (Exception e) {
            log.error("Failed to send group new races email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendTestCedricEmail(String to) {
        sendTestCedricEmail(to, EmailTheme.FOOTBALL);
    }

    private void sendTestCedricEmail(String to, EmailTheme theme) {
        try {
            emailSender.send(to, TestCedricEmailTemplate.SUBJECT, TestCedricEmailTemplate.build(theme));
            log.info("Test Cédric email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send Test Cédric email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de test. Vérifie ta configuration Resend.");
        }
    }
}
