package com.pronocore.service;

import com.pronocore.entity.PasswordResetToken;
import com.pronocore.entity.User;
import com.pronocore.repository.PasswordResetTokenRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

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
                .orElseThrow(() -> new IllegalArgumentException("Token invalide ou expiré"));

        if (!resetToken.isValid()) {
            throw new IllegalArgumentException("Token invalide ou expiré");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);
    }
}
