package com.pronocore.service;

import com.pronocore.entity.Bet;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderSchedulerService {

    private final MatchRepository matchRepository;
    private final BetRepository betRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final EmailService emailService;

    /**
     * Runs every minute. Finds UPCOMING matches starting in ~60 minutes (±1 min window)
     * and notifies group members who haven't placed their bet yet.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendMatchReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<Match> matches = matchRepository.findUpcomingMatchesForReminder(
                now.plusMinutes(59), now.plusMinutes(61));

        for (Match match : matches) {
            processMatch(match);
        }
    }

    private void processMatch(Match match) {
        List<Bet> openBets = betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(
                match.getId(), Bet.Status.OPEN);

        if (openBets.isEmpty()) {
            match.setReminderSent(true);
            matchRepository.save(match);
            return;
        }

        Set<Long> notifiedIds = new HashSet<>();
        Map<Long, User> userById = new HashMap<>();

        for (Bet bet : openBets) {
            Long groupId = bet.getGroup().getId();
            List<GroupMember> members = groupMemberRepository.findByGroupIdAndStatus(
                    groupId, GroupMember.MemberStatus.ACTIVE);

            for (GroupMember gm : members) {
                User user = gm.getUser();
                if (!user.isEmailReminderEnabled()) continue;
                if (notifiedIds.contains(user.getId())) continue;
                if (betParticipationRepository.existsByUserIdAndMatchId(user.getId(), match.getId())) continue;

                notifiedIds.add(user.getId());
                userById.put(user.getId(), user);
            }
        }

        log.info("Match {}: sending reminders to {} user(s)", match.getId(), notifiedIds.size());
        for (User user : userById.values()) {
            emailService.sendMatchReminder(user, match);
        }

        match.setReminderSent(true);
        matchRepository.save(match);
    }
}
