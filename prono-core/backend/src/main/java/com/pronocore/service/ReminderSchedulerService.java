package com.pronocore.service;

import com.pronocore.entity.Bet;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderSchedulerService {

    private final MatchRepository matchRepository;
    private final BetRepository betRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    /**
     * Runs every minute. When a match enters the 4h-before window, collects every
     * user who hasn't been reminded for that trigger day yet, fetches ALL their pending
     * matches up to the end of the trigger day, and sends a single consolidated email.
     * At most one email per user per trigger calendar day (which may be tomorrow for
     * early-morning matches whose window fires the previous evening).
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendMatchReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        List<Match> triggerMatches = matchRepository.findUpcomingMatchesForReminder(
                now.plusMinutes(239), now.plusMinutes(241));

        if (triggerMatches.isEmpty()) return;

        // Use the calendar day of the furthest trigger match as the reminder key.
        // This handles early-morning matches (0h–4h) whose 4h window fires the
        // previous evening: their date is tomorrow, so the window and the
        // dedup key must extend into the next calendar day.
        LocalDate latestTriggerDay = triggerMatches.stream()
                .map(m -> m.getMatchDate().toLocalDate())
                .max(LocalDate::compareTo)
                .orElse(today);

        // Collect users who need a reminder (not yet reminded for this trigger day,
        // reminder enabled, and have at least one unbet match in the trigger window)
        Map<Long, User> usersToRemind = new LinkedHashMap<>();

        for (Match match : triggerMatches) {
            List<Bet> openBets = betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(
                    match.getId(), Bet.Status.OPEN);

            for (Bet bet : openBets) {
                List<GroupMember> members = groupMemberRepository.findByGroupIdAndStatus(
                        bet.getGroup().getId(), GroupMember.MemberStatus.ACTIVE);

                for (GroupMember gm : members) {
                    User user = gm.getUser();
                    if (!user.isEmailReminderEnabled()) continue;
                    // Dedup against the trigger day (not "today") so a user reminded
                    // earlier today for a 15h match still receives the 2h-next-morning email.
                    if (latestTriggerDay.equals(user.getReminderSentDate())) continue;
                    if (betParticipationRepository.existsByUserIdAndMatchId(user.getId(), match.getId())) continue;
                    usersToRemind.put(user.getId(), user);
                }
            }
        }

        log.info("Triggered by {} match(es), reminding {} user(s)", triggerMatches.size(), usersToRemind.size());

        // Window: from start of today to start of the day after the trigger match day.
        // Covers both same-day matches and early-morning matches of the next calendar day.
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfWindow = latestTriggerDay.plusDays(1).atStartOfDay();

        for (User user : usersToRemind.values()) {
            // Fetch ALL pending matches in the window this user hasn't bet on yet
            List<Match> allPending = matchRepository.findPendingMatchesTodayForUser(
                    user.getId(), startOfDay, endOfWindow, now);

            if (!allPending.isEmpty()) {
                emailService.sendMatchReminder(user, allPending);
                log.info("Reminder sent to {} ({}) for {} match(es): {}",
                        user.getUsername(), user.getEmail(), allPending.size(),
                        allPending.stream().map(m -> m.getTeamA() + " vs " + m.getTeamB()).toList());
            }
            user.setReminderSentDate(latestTriggerDay);
            userRepository.save(user);
        }

        triggerMatches.forEach(m -> {
            m.setReminderSent(true);
            matchRepository.save(m);
        });
    }
}
