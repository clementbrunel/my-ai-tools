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
import java.util.ArrayList;
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
    private final EmailService emailService;

    /**
     * Runs every minute. Finds UPCOMING matches starting in ~60 minutes (±1 min window)
     * and sends one email per user listing all matches they haven't bet on yet.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendMatchReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<Match> matches = matchRepository.findUpcomingMatchesForReminder(
                now.plusMinutes(239), now.plusMinutes(241));

        if (matches.isEmpty()) return;

        // userId -> User
        Map<Long, User> userById = new LinkedHashMap<>();
        // userId -> ordered list of distinct matches the user hasn't bet on
        Map<Long, Map<Long, Match>> pendingMatchesByUser = new LinkedHashMap<>();

        for (Match match : matches) {
            List<Bet> openBets = betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(
                    match.getId(), Bet.Status.OPEN);

            for (Bet bet : openBets) {
                Long groupId = bet.getGroup().getId();
                List<GroupMember> members = groupMemberRepository.findByGroupIdAndStatus(
                        groupId, GroupMember.MemberStatus.ACTIVE);

                for (GroupMember gm : members) {
                    User user = gm.getUser();
                    if (!user.isEmailReminderEnabled()) continue;
                    if (betParticipationRepository.existsByUserIdAndMatchId(user.getId(), match.getId())) continue;

                    userById.put(user.getId(), user);
                    pendingMatchesByUser
                            .computeIfAbsent(user.getId(), k -> new LinkedHashMap<>())
                            .putIfAbsent(match.getId(), match);
                }
            }
        }

        log.info("Sending match reminder(s) to {} user(s) for {} match(es)",
                pendingMatchesByUser.size(), matches.size());

        for (Map.Entry<Long, Map<Long, Match>> entry : pendingMatchesByUser.entrySet()) {
            User user = userById.get(entry.getKey());
            List<Match> pendingMatches = new ArrayList<>(entry.getValue().values());
            emailService.sendMatchReminder(user, pendingMatches);
        }

        matches.forEach(m -> {
            m.setReminderSent(true);
            matchRepository.save(m);
        });
    }
}
