package com.pronocore.service.scheduler;

import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.repository.RaceRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.service.EmailService;
import com.pronocore.service.f1.F1SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Every 30 minutes, once a Grand Prix should be over, tries to import its classification from
 * jolpica. A successful import only stages a draft (nothing is settled, no player email) and
 * notifies every PLATFORM_ADMIN that it is ready to be reviewed and validated. Retries stop on
 * their own as soon as a draft exists, the admin settled the race, or the retry window closes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class F1ResultsImportSchedulerService {

    private final RaceRepository raceRepository;
    private final UserRepository userRepository;
    private final F1SyncService f1SyncService;
    private final EmailService emailService;

    @Value("${app.f1-auto-import.enabled:true}")
    private boolean enabled;

    /** Minutes after the start before the first attempt — roughly the race's duration. */
    @Value("${app.f1-auto-import.race-duration-minutes:120}")
    private long raceDurationMinutes;

    /** Hours after the start beyond which we stop retrying (the admin can still use the manual import). */
    @Value("${app.f1-auto-import.give-up-hours:48}")
    private long giveUpHours;

    @Scheduled(cron = "0 */30 * * * *")
    public void importFinishedRaces() {
        if (!enabled) return;
        LocalDateTime now = LocalDateTime.now();
        List<Race> candidates = raceRepository.findAwaitingResultsImport(
                now.minusHours(giveUpHours), now.minusMinutes(raceDurationMinutes));

        for (Race race : candidates) {
            try {
                if (f1SyncService.importResultsDraftIfAvailable(race.getId())) {
                    notifyAdmins(race);
                } else {
                    log.debug("F1 auto-import: no jolpica results yet for {}", race.getName());
                }
            } catch (Exception e) {
                // jolpica down / partial classification — the next tick retries.
                log.warn("F1 auto-import failed for {}: {}", race.getName(), e.getMessage());
            }
        }
    }

    private void notifyAdmins(Race race) {
        List<User> admins = userRepository.findByRole(User.Role.PLATFORM_ADMIN);
        admins.forEach(admin -> emailService.sendAdminResultsReadyEmail(admin, race));
        log.info("F1 auto-import: draft staged for {} — {} admin(s) notified", race.getName(), admins.size());
    }
}
