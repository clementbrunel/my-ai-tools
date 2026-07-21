package com.pronocore.service;

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
import com.pronocore.service.email.template.MembershipRequestEmailTemplate;
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

    /**
     * Each template is intrinsically tied to one sport theme — the caller no longer
     * picks one. Exhaustive so adding a new {@link EmailType} (e.g. an upcoming F1
     * template) forces a conscious theme choice at compile time.
     */
    private EmailTheme themeFor(EmailType emailType) {
        return switch (emailType) {
            case VERIFICATION, PASSWORD_RESET, TEST_CEDRIC, GAGE_RESOLUTION, GROUP_MEMBERSHIP_REQUEST -> EmailTheme.NEUTRAL;
            case MATCH_REMINDER, GROUP_NEW_MATCHES -> EmailTheme.FOOTBALL;
            case RACE_REMINDER, GROUP_NEW_RACES -> EmailTheme.F1;
        };
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
            case RACE_REMINDER -> {
                User fakeUser = User.builder().username("joueur_test").email(to).emailReminderEnabled(true).build();
                List<Race> fakeRaces = List.of(
                    Race.builder().id(0L).name("Grand Prix de Monaco").circuit("Circuit de Monaco")
                        .round(7).qualifyingDate(LocalDateTime.now().plusMinutes(65))
                        .raceDate(LocalDateTime.now().plusHours(1))
                        .competition(F1_CHAMPIONSHIP_2026).reminderSent(false).build()
                );
                emailSender.send(to, RaceReminderEmailTemplate.subject(fakeRaces),
                    RaceReminderEmailTemplate.build(themeFor(EmailType.RACE_REMINDER), fakeUser, fakeRaces, frontendUrl));
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
            case GROUP_MEMBERSHIP_REQUEST -> {
                User fakeLeader = User.builder().username("chef_test").displayName("Le Chef").email(to).build();
                User fakeApplicant = User.builder().username("nouveau_test").displayName("Le Nouveau").build();
                sendMembershipRequestEmail(fakeLeader, "Groupe des Amis", fakeApplicant);
            }
            case TEST_CEDRIC -> sendTestCedricEmail(to);
        }
    }

    public void sendVerificationEmail(String to, String token) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        try {
            emailSender.send(to, VerificationEmailTemplate.SUBJECT,
                VerificationEmailTemplate.build(themeFor(EmailType.VERIFICATION), verifyUrl));
            log.info("Verification email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de vérification. Vérifie ta configuration Resend.");
        }
    }

    public void sendPasswordResetEmail(String to, String token) {
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        try {
            emailSender.send(to, PasswordResetEmailTemplate.SUBJECT,
                PasswordResetEmailTemplate.build(themeFor(EmailType.PASSWORD_RESET), resetUrl));
            log.info("Password reset email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de réinitialisation. Vérifie ta configuration Resend.");
        }
    }

    public void sendMatchReminder(User user, List<Match> matches) {
        if (matches.isEmpty()) return;
        try {
            emailSender.send(user.getEmail(), MatchReminderEmailTemplate.subject(matches),
                MatchReminderEmailTemplate.build(themeFor(EmailType.MATCH_REMINDER), user, matches, frontendUrl));
            log.info("Match reminder sent to {} ({} match(es))", user.getEmail(), matches.size());
        } catch (Exception e) {
            log.error("Failed to send match reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    public void sendRaceReminder(User user, List<Race> races) {
        if (races.isEmpty()) return;
        try {
            emailSender.send(user.getEmail(), RaceReminderEmailTemplate.subject(races),
                RaceReminderEmailTemplate.build(themeFor(EmailType.RACE_REMINDER), user, races, frontendUrl));
            log.info("Race reminder sent to {} ({} race(s))", user.getEmail(), races.size());
        } catch (Exception e) {
            log.error("Failed to send race reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    public void sendGageResolutionEmail(User recipient, String forfeitTitle, String forfeitDescription,
                                        User assignedTo, String groupName, Map<String, Integer> dailyScores) {
        sendGageResolutionEmail(recipient, forfeitTitle, forfeitDescription, assignedTo, groupName, dailyScores,
            themeFor(EmailType.GAGE_RESOLUTION), "de pronostics");
    }

    /**
     * Unlike every other template, the gage's sport isn't fixed by the {@link EmailType} —
     * a daily gage can be settled from foot matches, F1 races, or both in a mixed group.
     * The caller (whoever actually looked at that day's participations) picks the theme
     * and the day label so the wording matches the palette; {@link #themeFor} and the
     * "de pronostics" default only cover the neutral fallback used by previews.
     */
    public void sendGageResolutionEmail(User recipient, String forfeitTitle, String forfeitDescription,
                                        User assignedTo, String groupName, Map<String, Integer> dailyScores,
                                        EmailTheme theme, String dayLabel) {
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String assignedToName = assignedTo.getDisplayName() != null ? assignedTo.getDisplayName() : assignedTo.getUsername();
        try {
            emailSender.send(recipient.getEmail(), GageResolutionEmailTemplate.subject(groupName),
                GageResolutionEmailTemplate.build(theme, displayName, forfeitTitle, forfeitDescription, assignedToName, groupName, dailyScores, dayLabel));
            log.info("Gage resolution email sent to {} (group {})", recipient.getEmail(), groupName);
        } catch (Exception e) {
            log.error("Failed to send gage resolution email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendGroupNewMatchesEmail(User recipient, String groupName, User leader, List<Match> matches) {
        if (matches.isEmpty()) return;
        String displayName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String leaderName = leader.getDisplayName() != null ? leader.getDisplayName() : leader.getUsername();
        try {
            emailSender.send(recipient.getEmail(), GroupNewMatchesEmailTemplate.subject(groupName, matches),
                GroupNewMatchesEmailTemplate.build(themeFor(EmailType.GROUP_NEW_MATCHES), displayName, groupName, leaderName, matches, frontendUrl));
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
                GroupNewRacesEmailTemplate.build(themeFor(EmailType.GROUP_NEW_RACES), displayName, groupName, leaderName, races, frontendUrl));
            log.info("Group new races email sent to {} (group {}, {} race(s))", recipient.getEmail(), groupName, races.size());
        } catch (Exception e) {
            log.error("Failed to send group new races email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendMembershipRequestEmail(User recipient, String groupName, User applicant) {
        sendMembershipRequestEmail(recipient, groupName, applicant, themeFor(EmailType.GROUP_MEMBERSHIP_REQUEST));
    }

    /**
     * Like the gage resolution email, the theme here isn't fixed by the {@link EmailType} —
     * it depends on the sport(s) the group plays, not on the request itself. The caller
     * (whoever knows the group's sports) picks the theme; {@link #themeFor} only covers
     * the neutral fallback used by previews.
     */
    public void sendMembershipRequestEmail(User recipient, String groupName, User applicant, EmailTheme theme) {
        String recipientName = recipient.getDisplayName() != null ? recipient.getDisplayName() : recipient.getUsername();
        String applicantName = applicant.getDisplayName() != null ? applicant.getDisplayName() : applicant.getUsername();
        try {
            emailSender.send(recipient.getEmail(), MembershipRequestEmailTemplate.subject(groupName),
                MembershipRequestEmailTemplate.build(theme, recipientName, applicantName, groupName, frontendUrl));
            log.info("Membership request email sent to {} (group {}, applicant {})", recipient.getEmail(), groupName, applicantName);
        } catch (Exception e) {
            log.error("Failed to send membership request email to {}: {}", recipient.getEmail(), e.getMessage());
        }
    }

    public void sendTestCedricEmail(String to) {
        try {
            emailSender.send(to, TestCedricEmailTemplate.SUBJECT, TestCedricEmailTemplate.build(themeFor(EmailType.TEST_CEDRIC)));
            log.info("Test Cédric email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send Test Cédric email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email de test. Vérifie ta configuration Resend.");
        }
    }
}
