package com.pronocore.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartupListener {

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("⚽ Prono Core is ready!");
        log.info("🏆 Swagger UI: http://localhost:8090/swagger-ui.html");
    }
}
