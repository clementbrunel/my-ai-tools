package com.pronocore.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    // Set env var APP_FLYWAY_REPAIR=true to repair checksum mismatches on startup
    // (e.g. after editing an already-applied migration), then remove it.
    @Bean
    public FlywayMigrationStrategy migrationStrategy(
            @Value("${app.flyway.repair:false}") boolean repair) {
        return flyway -> {
            if (repair) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}
