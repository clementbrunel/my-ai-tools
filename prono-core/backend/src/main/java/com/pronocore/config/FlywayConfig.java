package com.pronocore.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    // Activated by env var APP_FLYWAY_REPAIR=true — run once when a checksum
    // mismatch occurs (edited migration), then remove the var and restart.
    @Bean
    @ConditionalOnProperty(name = "app.flyway.repair", havingValue = "true")
    public FlywayMigrationStrategy repairBeforeMigrate() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
