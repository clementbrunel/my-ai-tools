package com.pronocore.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Demo data is loaded via Flyway V2__demo_data.sql migration.
 * This class can be used for additional runtime initialization if needed.
 */
@Slf4j
@Component
public class DataInitializer {

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("⚽ Prono Core is ready! Demo data loaded via Flyway migrations.");
        log.info("🏆 Swagger UI available at: http://localhost:8080/swagger-ui.html");
        log.info("📋 Demo accounts available — see V2__demo_data.sql for details.");
    }
}
