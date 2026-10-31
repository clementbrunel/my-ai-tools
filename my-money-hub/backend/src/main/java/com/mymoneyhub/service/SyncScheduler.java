package com.mymoneyhub.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Triggers {@link SyncService#syncAll()} on the cron configured in {@code mymoneyhub.sync.cron}. */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "mymoneyhub.sync", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SyncScheduler {

    private final SyncService syncService;

    @Scheduled(cron = "${mymoneyhub.sync.cron:0 0 6 * * *}")
    public void scheduledSync() {
        log.info("Scheduled sync started");
        syncService.syncAll();
        log.info("Scheduled sync finished");
    }
}
