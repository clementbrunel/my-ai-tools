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
 * Post-session jolpica imports, both staged as drafts the admins validate:
 * <ul>
 *   <li><b>Starting grid</b> — every 30 min between the end of qualifying and the race start.
 *       A staged grid emails the admins "grille à valider"; still nothing on jolpica
 *       {@code qualifying-late-alert-hours} after qualifying → a one-off "saisis-la à la main"
 *       reminder (retries go on until the race start).</li>
 *   <li><b>Race classification</b> — described below.</li>
 * </ul>
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

    /** Minutes after the qualifying start before the first grid attempt — roughly the session's duration. */
    @Value("${app.f1-auto-import.qualifying-duration-minutes:60}")
    private long qualifyingDurationMinutes;

    /** Hours after the qualifying start with still no grid on jolpica before the admins are told to type it in. */
    @Value("${app.f1-auto-import.qualifying-late-alert-hours:6}")
    private long qualifyingLateAlertHours;

    @Scheduled(cron = "0 15,45 * * * *")
    public void importQualifyingGrids() {
        if (!enabled) return;
        LocalDateTime now = LocalDateTime.now();
        for (Race race : raceRepository.findAwaitingQualifyingImport(now.minusMinutes(qualifyingDurationMinutes), now)) {
            try {
                if (f1SyncService.importQualifyingDraftIfAvailable(race.getId())) {
                    List<User> admins = admins();
                    admins.forEach(admin -> emailService.sendAdminQualifyingReadyEmail(admin, race));
                    log.info("F1 auto-import: grid draft staged for {} — {} admin(s) notified", race.getName(), admins.size());
                    continue;
                }
                log.debug("F1 auto-import: no jolpica grid yet for {}", race.getName());
            } catch (Exception e) {
                // jolpica down — the next tick retries; the late alert below still applies.
                log.warn("F1 grid auto-import failed for {}: {}", race.getName(), e.getMessage());
            }
            alertIfGridLate(race, now);
        }
    }

    private void alertIfGridLate(Race race, LocalDateTime now) {
        if (race.isQualifyingLateAlertSent()
                || now.isBefore(race.getQualifyingDate().plusHours(qualifyingLateAlertHours))) {
            return;
        }
        List<User> admins = admins();
        admins.forEach(admin -> emailService.sendAdminQualifyingLateEmail(admin, race));
        race.setQualifyingLateAlertSent(true);
        raceRepository.save(race);
        log.info("F1 auto-import: grid still missing on jolpica for {} — {} admin(s) alerted", race.getName(), admins.size());
    }

    private List<User> admins() {
        return userRepository.findByRole(User.Role.PLATFORM_ADMIN);
    }

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
