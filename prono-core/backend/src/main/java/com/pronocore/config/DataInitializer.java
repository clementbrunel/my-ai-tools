package com.pronocore.config;

import com.pronocore.entity.User;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Encodes placeholder passwords inserted by Flyway migrations at first startup.
 * Passwords are never stored as bcrypt hashes in SQL — encoding happens here.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo.password}")
    private String demoPassword;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        initDemoPasswords();
        log.info("⚽ Prono Core is ready!");
        log.info("🏆 Swagger UI: http://localhost:8080/swagger-ui.html");
    }

    private void initDemoPasswords() {
        List<User> pending = userRepository.findAll().stream()
            .filter(u -> "PLACEHOLDER".equals(u.getPassword()))
            .toList();

        if (pending.isEmpty()) return;

        String encoded = passwordEncoder.encode(demoPassword);
        pending.forEach(u -> u.setPassword(encoded));
        userRepository.saveAll(pending);
        log.info("🔐 Initialized passwords for {} demo user(s)", pending.size());
    }
}
