package com.pronocore.service.scheduler;

import com.pronocore.entity.Bet;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.F1PredictionRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.RaceRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.service.EmailService;
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
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Three near-identical reminder pipelines (match / race / qualifying), sharing one
 * generic shape: find entities entering their 4h-before trigger window, collect every
 * user who hasn't been reminded for that trigger day and hasn't already responded, then
 * send each a single consolidated email and mark both the users and the trigger entities
 * as reminded. The three flavors differ only in: the entity type, the "already responded"
 * predicate, which per-user date field tracks the dedup, and how the entity gets flagged
 * done — all threaded through as lambdas so each flavor keeps its own business wording
 * (see the per-method javadoc below for the specific rules).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderSchedulerService {

    private final MatchRepository matchRepository;
    private final RaceRepository raceRepository;
    private final BetRepository betRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final F1PredictionRepository f1PredictionRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @FunctionalInterface
    private interface PendingFetcher<T> {
        List<T> fetch(Long userId, LocalDateTime startOfDay, LocalDateTime endOfWindow, LocalDateTime now);
    }

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
        List<Match> triggerMatches = matchRepository.findUpcomingMatchesForReminder(
                LocalDateTime.now().plusMinutes(239), LocalDateTime.now().plusMinutes(241));
        if (triggerMatches.isEmpty()) return;

        runReminderPipeline(
                triggerMatches,
                Match::getMatchDate,
                match -> betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(match.getId(), Bet.Status.OPEN),
                User::getReminderSentDate,
                (user, day) -> user.setReminderSentDate(day),
                (user, match) -> betParticipationRepository.existsByUserIdAndMatchId(user.getId(), match.getId()),
                "match(es)",
                matchRepository::findPendingMatchesTodayForUser,
                (user, allPending) -> {
                    emailService.sendMatchReminder(user, allPending);
                    log.info("Reminder sent to {} ({}) for {} match(es): {}",
                            user.getUsername(), user.getEmail(), allPending.size(),
                            allPending.stream().map(m -> m.getTeamA().getName() + " vs " + m.getTeamB().getName()).toList());
                },
                match -> {
                    match.setReminderSent(true);
                    matchRepository.save(match);
                });
    }

    /**
     * F1 counterpart of {@link #sendMatchReminders()}: when a race enters the 4h-before
     * window, reminds every user who hasn't predicted it yet and hasn't already been
     * reminded for that trigger day. There is no equivalent reminder for the sprint —
     * the sprint has no betting attached, only championship points (see Race.sprintDate).
     * "Hasn't predicted" here means no participation at all — this reminder deliberately
     * ignores whether the pole pick specifically is filled in; only
     * {@link #sendQualifyingReminders()} cares about that field.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendRaceReminders() {
        List<Race> triggerRaces = raceRepository.findUpcomingRacesForReminder(
                LocalDateTime.now().plusMinutes(239), LocalDateTime.now().plusMinutes(241));
        if (triggerRaces.isEmpty()) return;

        runReminderPipeline(
                triggerRaces,
                Race::getRaceDate,
                race -> betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.OPEN),
                User::getRaceReminderSentDate,
                (user, day) -> user.setRaceReminderSentDate(day),
                (user, race) -> betParticipationRepository.existsByUserIdAndRaceId(user.getId(), race.getId()),
                "race(s)",
                raceRepository::findPendingRacesTodayForUser,
                (user, allPending) -> {
                    emailService.sendRaceReminder(user, allPending);
                    log.info("Race reminder sent to {} ({}) for {} race(s): {}",
                            user.getUsername(), user.getEmail(), allPending.size(),
                            allPending.stream().map(Race::getName).toList());
                },
                race -> {
                    race.setReminderSent(true);
                    raceRepository.save(race);
                });
    }

    /**
     * F1-only reminder that fires 4h ahead of qualifying rather than the race start, since the
     * pole pick locks at {@code qualifyingDate} while the rest of the prediction (podium, fastest
     * lap, last place) still locks at {@code raceDate} — see {@link #sendRaceReminders()}, which
     * still runs independently and covers those other picks. Unlike the race reminder, "needs a
     * reminder" here is based specifically on the pole field being unset ({@link
     * F1PredictionRepository#existsPoleByUserIdAndRaceId}), not on participation existence — a
     * user can already have a full prediction for everything else and still be missing their
     * pole pick. Same dedup rules otherwise (one email per user per trigger day), windowed on
     * qualifyingDate and tracked via its own flags so the two reminders don't interfere.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendQualifyingReminders() {
        List<Race> triggerRaces = raceRepository.findUpcomingRacesForQualifyingReminder(
                LocalDateTime.now().plusMinutes(239), LocalDateTime.now().plusMinutes(241));
        if (triggerRaces.isEmpty()) return;

        runReminderPipeline(
                triggerRaces,
                Race::getQualifyingDate,
                race -> betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(race.getId(), Bet.Status.OPEN),
                User::getQualifyingReminderSentDate,
                (user, day) -> user.setQualifyingReminderSentDate(day),
                (user, race) -> f1PredictionRepository.existsPoleByUserIdAndRaceId(user.getId(), race.getId()),
                "race qualifying(s)",
                raceRepository::findPendingRacesTodayForUserBeforeQualifying,
                (user, allPending) -> {
                    emailService.sendQualifyingReminder(user, allPending);
                    log.info("Qualifying reminder sent to {} ({}) for {} race(s): {}",
                            user.getUsername(), user.getEmail(), allPending.size(),
                            allPending.stream().map(Race::getName).toList());
                },
                race -> {
                    race.setQualifyingReminderSent(true);
                    raceRepository.save(race);
                });
    }

    /**
     * Shared shape of the three reminder flows above.
     *
     * @param triggerEntities  entities that just entered their reminder window
     * @param dateOf           the entity's trigger date (matchDate / raceDate / qualifyingDate)
     * @param openBetsOf       OPEN bets for that entity, across all groups
     * @param lastSentOf       per-user dedup date already recorded for this reminder flavor
     * @param markUserSent     records today's trigger day on the user (mutates in place)
     * @param alreadyResponded true if the user no longer needs this reminder (bet placed / predicted / pole picked)
     * @param entityNounPlural used only for the summary log line
     * @param fetchPending     entities still pending for a user within the reminder window
     * @param sendAndLog       sends the consolidated email and logs it; only invoked when the pending list is non-empty
     * @param markEntitySent   flags the trigger entity as reminded and persists it
     */
    private <T> void runReminderPipeline(
            List<T> triggerEntities,
            Function<T, LocalDateTime> dateOf,
            Function<T, List<Bet>> openBetsOf,
            Function<User, LocalDate> lastSentOf,
            BiConsumer<User, LocalDate> markUserSent,
            BiPredicate<User, T> alreadyResponded,
            String entityNounPlural,
            PendingFetcher<T> fetchPending,
            BiConsumer<User, List<T>> sendAndLog,
            Consumer<T> markEntitySent) {

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        // Use the calendar day of the furthest trigger entity as the reminder key. This
        // handles early-morning events (0h–4h) whose 4h window fires the previous evening:
        // their date is tomorrow, so the window and the dedup key must extend into the next day.
        LocalDate latestTriggerDay = triggerEntities.stream()
                .map(dateOf).map(LocalDateTime::toLocalDate)
                .max(LocalDate::compareTo)
                .orElse(today);

        Map<Long, User> usersToRemind = collectUsersToRemind(
                triggerEntities, openBetsOf, latestTriggerDay, lastSentOf, alreadyResponded);

        log.info("Triggered by {} {}, reminding {} user(s)", triggerEntities.size(), entityNounPlural, usersToRemind.size());

        // Window: from start of today to start of the day after the trigger day. Covers
        // both same-day events and early-morning events of the next calendar day.
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfWindow = latestTriggerDay.plusDays(1).atStartOfDay();

        for (User user : usersToRemind.values()) {
            List<T> allPending = fetchPending.fetch(user.getId(), startOfDay, endOfWindow, now);
            if (!allPending.isEmpty()) {
                sendAndLog.accept(user, allPending);
            }
            markUserSent.accept(user, latestTriggerDay);
            userRepository.save(user);
        }

        triggerEntities.forEach(markEntitySent);
    }

    /** Users who need a reminder: enabled, not yet reminded for this trigger day, and haven't already responded. */
    private <T> Map<Long, User> collectUsersToRemind(
            List<T> triggerEntities,
            Function<T, List<Bet>> openBetsOf,
            LocalDate latestTriggerDay,
            Function<User, LocalDate> lastSentOf,
            BiPredicate<User, T> alreadyResponded) {

        Map<Long, User> usersToRemind = new LinkedHashMap<>();
        for (T entity : triggerEntities) {
            for (Bet bet : openBetsOf.apply(entity)) {
                List<GroupMember> members = groupMemberRepository.findByGroupIdAndStatus(
                        bet.getGroup().getId(), GroupMember.MemberStatus.ACTIVE);

                for (GroupMember gm : members) {
                    User user = gm.getUser();
                    if (!user.isEmailReminderEnabled()) continue;
                    // Dedup against the trigger day (not "today") so a user reminded
                    // earlier today for a 15h event still receives the 2h-next-morning email.
                    if (latestTriggerDay.equals(lastSentOf.apply(user))) continue;
                    if (alreadyResponded.test(user, entity)) continue;
                    usersToRemind.put(user.getId(), user);
                }
            }
        }
        return usersToRemind;
    }
}
