package com.pronocore.service.scheduler;

import com.pronocore.entity.Bet;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.Team;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.F1PredictionRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.RaceRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the three near-identical reminder pipelines (match / race / qualifying):
 * the trigger window, the "already reminded today" and "already responded" dedup
 * rules, and the reminder-sent bookkeeping. These pipelines share one generic
 * implementation ({@link ReminderSchedulerService}); this suite pins down the
 * per-flavor differences (dedup field, "responded" predicate, entity flags) so a
 * future refactor of the shared plumbing can't silently blend them.
 */
@ExtendWith(MockitoExtension.class)
class ReminderSchedulerServiceTest {

    @Mock private MatchRepository matchRepository;
    @Mock private RaceRepository raceRepository;
    @Mock private BetRepository betRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private BetParticipationRepository betParticipationRepository;
    @Mock private F1PredictionRepository f1PredictionRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;

    @InjectMocks
    private ReminderSchedulerService reminderSchedulerService;

    private Group group;
    private User user;
    private GroupMember membership;

    @BeforeEach
    void setUp() {
        group = Group.builder().id(1L).name("Les Potes").build();
        user = User.builder().id(1L).username("alice").email("alice@test.com")
                .emailReminderEnabled(true).build();
        membership = GroupMember.builder().id(1L).group(group).user(user)
                .status(GroupMember.MemberStatus.ACTIVE).build();
    }

    // ── sendMatchReminders ───────────────────────────────────────────────────

    @Test
    void sendMatchReminders_shouldEmailUserWithAnUnbetMatchInTheTriggerWindow() {
        Match trigger = Match.builder().id(10L).matchDate(LocalDateTime.now().plusHours(4))
                .teamA(Team.builder().id(1L).name("France").build())
                .teamB(Team.builder().id(2L).name("Brésil").build())
                .build();
        Bet openBet = Bet.builder().id(100L).status(Bet.Status.OPEN).group(group).build();

        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(10L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(betParticipationRepository.existsByUserIdAndMatchId(1L, 10L)).thenReturn(false);
        when(matchRepository.findPendingMatchesTodayForUser(eq(1L), any(), any(), any()))
                .thenReturn(List.of(trigger));

        reminderSchedulerService.sendMatchReminders();

        verify(emailService).sendMatchReminder(eq(user), eq(List.of(trigger)));
        verify(userRepository).save(user);
        verify(matchRepository).save(trigger);
        assertThat(user.getReminderSentDate()).isNotNull();
        assertThat(trigger.isReminderSent()).isTrue();
    }

    @Test
    void sendMatchReminders_shouldSkipUserWithRemindersDisabled() {
        user.setEmailReminderEnabled(false);
        Match trigger = Match.builder().id(10L).matchDate(LocalDateTime.now().plusHours(4)).build();
        Bet openBet = Bet.builder().id(100L).status(Bet.Status.OPEN).group(group).build();

        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(10L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));

        reminderSchedulerService.sendMatchReminders();

        verify(emailService, never()).sendMatchReminder(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void sendMatchReminders_shouldSkipUserWhoAlreadyBetOnTheMatch() {
        Match trigger = Match.builder().id(10L).matchDate(LocalDateTime.now().plusHours(4)).build();
        Bet openBet = Bet.builder().id(100L).status(Bet.Status.OPEN).group(group).build();

        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(10L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(betParticipationRepository.existsByUserIdAndMatchId(1L, 10L)).thenReturn(true);

        reminderSchedulerService.sendMatchReminders();

        verify(emailService, never()).sendMatchReminder(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void sendMatchReminders_shouldSkipUserAlreadyRemindedForTheTriggerDay() {
        LocalDateTime matchDate = LocalDateTime.now().plusHours(4);
        user.setReminderSentDate(matchDate.toLocalDate());
        Match trigger = Match.builder().id(10L).matchDate(matchDate).build();
        Bet openBet = Bet.builder().id(100L).status(Bet.Status.OPEN).group(group).build();

        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(10L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));

        reminderSchedulerService.sendMatchReminders();

        verify(emailService, never()).sendMatchReminder(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void sendMatchReminders_shouldDoNothingWhenNoTriggerMatch() {
        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of());

        reminderSchedulerService.sendMatchReminders();

        verify(betRepository, never()).findByMatchIdAndStatusOrderByCreatedAtDesc(anyLong(), any());
        verify(emailService, never()).sendMatchReminder(any(), any());
    }

    @Test
    void sendMatchReminders_shouldStillMarkReminderSentDateWhenNoPendingMatchesLeft() {
        // e.g. the only pending match kicked off in the few seconds between the trigger
        // query and the pending-matches query — no email, but the user is still marked
        // so they aren't re-evaluated on the next tick.
        Match trigger = Match.builder().id(10L).matchDate(LocalDateTime.now().plusHours(4)).build();
        Bet openBet = Bet.builder().id(100L).status(Bet.Status.OPEN).group(group).build();

        when(matchRepository.findUpcomingMatchesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(10L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(betParticipationRepository.existsByUserIdAndMatchId(1L, 10L)).thenReturn(false);
        when(matchRepository.findPendingMatchesTodayForUser(eq(1L), any(), any(), any()))
                .thenReturn(List.of());

        reminderSchedulerService.sendMatchReminders();

        verify(emailService, never()).sendMatchReminder(any(), any());
        verify(userRepository).save(user);
    }

    // ── sendRaceReminders ────────────────────────────────────────────────────

    @Test
    void sendRaceReminders_shouldEmailUserWithAnUnpredictedRaceInTheTriggerWindow() {
        Race trigger = Race.builder().id(20L).raceDate(LocalDateTime.now().plusHours(4))
                .qualifyingDate(LocalDateTime.now().plusHours(3)).build();
        Bet openBet = Bet.builder().id(200L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(20L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(betParticipationRepository.existsByUserIdAndRaceId(1L, 20L)).thenReturn(false);
        when(raceRepository.findPendingRacesTodayForUser(eq(1L), any(), any(), any()))
                .thenReturn(List.of(trigger));

        reminderSchedulerService.sendRaceReminders();

        verify(emailService).sendRaceReminder(eq(user), eq(List.of(trigger)));
        verify(userRepository).save(user);
        verify(raceRepository).save(trigger);
        assertThat(user.getRaceReminderSentDate()).isNotNull();
        assertThat(trigger.isReminderSent()).isTrue();
    }

    @Test
    void sendRaceReminders_shouldSkipUserWhoAlreadyPredictedTheRace() {
        Race trigger = Race.builder().id(20L).raceDate(LocalDateTime.now().plusHours(4))
                .qualifyingDate(LocalDateTime.now().plusHours(3)).build();
        Bet openBet = Bet.builder().id(200L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(20L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(betParticipationRepository.existsByUserIdAndRaceId(1L, 20L)).thenReturn(true);

        reminderSchedulerService.sendRaceReminders();

        verify(emailService, never()).sendRaceReminder(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void sendRaceReminders_shouldSkipUserAlreadyRemindedForTheTriggerDay() {
        LocalDateTime raceDate = LocalDateTime.now().plusHours(4);
        user.setRaceReminderSentDate(raceDate.toLocalDate());
        Race trigger = Race.builder().id(20L).raceDate(raceDate)
                .qualifyingDate(raceDate.minusHours(1)).build();
        Bet openBet = Bet.builder().id(200L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(20L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));

        reminderSchedulerService.sendRaceReminders();

        verify(emailService, never()).sendRaceReminder(any(), any());
    }

    // ── sendQualifyingReminders ──────────────────────────────────────────────

    @Test
    void sendQualifyingReminders_shouldEmailUserMissingThePolePick() {
        Race trigger = Race.builder().id(30L).qualifyingDate(LocalDateTime.now().plusHours(4))
                .raceDate(LocalDateTime.now().plusHours(24)).build();
        Bet openBet = Bet.builder().id(300L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForQualifyingReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(30L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(f1PredictionRepository.existsPoleByUserIdAndRaceId(1L, 30L)).thenReturn(false);
        when(raceRepository.findPendingRacesTodayForUserBeforeQualifying(eq(1L), any(), any(), any()))
                .thenReturn(List.of(trigger));

        reminderSchedulerService.sendQualifyingReminders();

        verify(emailService).sendQualifyingReminder(eq(user), eq(List.of(trigger)));
        verify(userRepository).save(user);
        verify(raceRepository).save(trigger);
        assertThat(user.getQualifyingReminderSentDate()).isNotNull();
        assertThat(trigger.isQualifyingReminderSent()).isTrue();
    }

    @Test
    void sendQualifyingReminders_shouldSkipUserWhoAlreadyPickedPole() {
        Race trigger = Race.builder().id(30L).qualifyingDate(LocalDateTime.now().plusHours(4))
                .raceDate(LocalDateTime.now().plusHours(24)).build();
        Bet openBet = Bet.builder().id(300L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForQualifyingReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(30L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(f1PredictionRepository.existsPoleByUserIdAndRaceId(1L, 30L)).thenReturn(true);

        reminderSchedulerService.sendQualifyingReminders();

        verify(emailService, never()).sendQualifyingReminder(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void sendQualifyingReminders_dedupIsIndependentFromRaceReminderDedup() {
        // The user was already reminded about the race itself (raceReminderSentDate set),
        // but the qualifying reminder tracks its own date — it must still fire.
        LocalDateTime qualifyingDate = LocalDateTime.now().plusHours(4);
        user.setRaceReminderSentDate(qualifyingDate.toLocalDate());
        Race trigger = Race.builder().id(30L).qualifyingDate(qualifyingDate)
                .raceDate(qualifyingDate.plusHours(24)).build();
        Bet openBet = Bet.builder().id(300L).status(Bet.Status.OPEN).group(group).build();

        when(raceRepository.findUpcomingRacesForQualifyingReminder(any(), any())).thenReturn(List.of(trigger));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(30L, Bet.Status.OPEN))
                .thenReturn(List.of(openBet));
        when(groupMemberRepository.findByGroupIdAndStatus(1L, GroupMember.MemberStatus.ACTIVE))
                .thenReturn(List.of(membership));
        when(f1PredictionRepository.existsPoleByUserIdAndRaceId(1L, 30L)).thenReturn(false);
        when(raceRepository.findPendingRacesTodayForUserBeforeQualifying(eq(1L), any(), any(), any()))
                .thenReturn(List.of(trigger));

        reminderSchedulerService.sendQualifyingReminders();

        verify(emailService, times(1)).sendQualifyingReminder(eq(user), eq(List.of(trigger)));
    }
}
