package com.pronocore.service;

import com.pronocore.entity.PasswordResetToken;
import com.pronocore.entity.User;
import com.pronocore.repository.PasswordResetTokenRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int TOKEN_EXPIRY_HOURS = 1;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    /**
     * Creates a reset token and sends the reset email.
     * Always returns silently even if the email is unknown to prevent user enumeration.
     */
    @Transactional
    public void initiateReset(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            tokenRepository.deleteByUser(user);

            String tokenValue = UUID.randomUUID().toString();
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token(tokenValue)
                    .user(user)
                    .expiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS))
                    .build();
            tokenRepository.save(resetToken);
            log.info("Password reset initiated for user: {}", user.getUsername());

            emailService.sendPasswordResetEmail(email, tokenValue);
        });
    }

    public boolean validateToken(String tokenValue) {
        return tokenRepository.findByToken(tokenValue)
                .map(PasswordResetToken::isValid)
                .orElse(false);
    }

    @Transactional
    public void resetPassword(String tokenValue, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(tokenValue)
                .orElseThrow(() -> {
                    log.warn("Password reset failed — token not found");
                    return new IllegalArgumentException("Token invalide ou expiré");
                });

        if (!resetToken.isValid()) {
            log.warn("Password reset failed — token expired or already used for user: {}",
                    resetToken.getUser().getUsername());
            throw new IllegalArgumentException("Token invalide ou expiré");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset completed for user: {}", user.getUsername());

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);
    }
}
