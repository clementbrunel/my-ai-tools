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
     * user who hasn't been reminded today, fetches ALL their pending matches of the day,
     * and sends a single consolidated email. At most one email per user per day.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendMatchReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        List<Match> triggerMatches = matchRepository.findUpcomingMatchesForReminder(
                now.plusMinutes(239), now.plusMinutes(241));

        if (triggerMatches.isEmpty()) return;

        // Collect users who need a reminder today (not yet reminded, reminder enabled,
        // and have at least one unbet match in the trigger window)
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
                    if (today.equals(user.getReminderSentDate())) continue;
                    if (betParticipationRepository.existsByUserIdAndMatchId(user.getId(), match.getId())) continue;
                    usersToRemind.put(user.getId(), user);
                }
            }
        }

        log.info("Triggered by {} match(es), reminding {} user(s)", triggerMatches.size(), usersToRemind.size());

        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay();

        for (User user : usersToRemind.values()) {
            // Fetch ALL matches today this user hasn't bet on (not just the trigger ones)
            List<Match> allPending = matchRepository.findPendingMatchesTodayForUser(
                    user.getId(), startOfDay, startOfNextDay, now);

            if (!allPending.isEmpty()) {
                emailService.sendMatchReminder(user, allPending);
            }
            user.setReminderSentDate(today);
            userRepository.save(user);
        }

        triggerMatches.forEach(m -> {
            m.setReminderSent(true);
            matchRepository.save(m);
        });
    }
}
