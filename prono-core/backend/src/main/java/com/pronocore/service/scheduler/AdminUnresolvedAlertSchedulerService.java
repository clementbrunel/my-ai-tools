package com.pronocore.service.scheduler;

import com.pronocore.entity.DailyGage;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.repository.DailyGageRepository;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.RaceRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Once a day, flags matches/races/gages still unresolved well past their deadline —
 * the auto-resolution pipelines (MatchSyncService, DailyGageService) only log a warning
 * on failure and never persist a failed state, so a stuck item is otherwise silent until
 * a player complains. Every PLATFORM_ADMIN gets the same digest; nothing is sent on a
 * clean day.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUnresolvedAlertSchedulerService {

    private final MatchRepository matchRepository;
    private final RaceRepository raceRepository;
    private final DailyGageRepository dailyGageRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Value("${app.admin-alerts.match-grace-hours}")
    private long matchGraceHours;

    @Value("${app.admin-alerts.race-grace-hours}")
    private long raceGraceHours;

    @Value("${app.admin-alerts.gage-grace-hours}")
    private long gageGraceHours;

    @Scheduled(cron = "0 0 8 * * *")
    public void sendDailyDigest() {
        LocalDateTime now = LocalDateTime.now();

        List<Match> overdueMatches = matchRepository.findOverdueUnresolvedMatches(now.minusHours(matchGraceHours));
        List<Race> overdueRaces = raceRepository.findOverdueUnresolvedRaces(now.minusHours(raceGraceHours));
        // A gage's matchDate is a calendar day; its own deadline is the end of that day (24h in),
        // then the gage-specific grace period on top.
        List<DailyGage> overdueGages = dailyGageRepository.findOverdueUnsettledGages(now.minusHours(24 + gageGraceHours).toLocalDate());

        if (overdueMatches.isEmpty() && overdueRaces.isEmpty() && overdueGages.isEmpty()) {
            log.debug("AdminUnresolvedAlertSchedulerService: nothing overdue — no digest sent");
            return;
        }

        List<User> admins = userRepository.findByRole(User.Role.PLATFORM_ADMIN);
        admins.forEach(admin -> emailService.sendAdminUnresolvedAlert(admin, overdueMatches, overdueRaces, overdueGages));

        log.info("AdminUnresolvedAlertSchedulerService: digest sent to {} admin(s) — {} match(es), {} race(s), {} gage(s) overdue",
            admins.size(), overdueMatches.size(), overdueRaces.size(), overdueGages.size());
    }
}
