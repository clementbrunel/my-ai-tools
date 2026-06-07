package com.pronocore.service;

import com.pronocore.dto.request.LoginRequest;
import com.pronocore.dto.request.RegisterRequest;
import com.pronocore.dto.response.AuthResponse;
import com.pronocore.dto.response.RegisterResponse;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.UserRepository;
import com.pronocore.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final UserMapper userMapper;
    private final EmailService emailService;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken: " + request.getUsername());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use: " + request.getEmail());
        }

        String verificationToken = UUID.randomUUID().toString();

        User user = User.builder()
            .username(request.getUsername())
            .email(request.getEmail())
            .password(passwordEncoder.encode(request.getPassword()))
            .role(User.Role.USER)
            .emailVerified(false)
            .verificationToken(verificationToken)
            .tokenExpiry(LocalDateTime.now().plusHours(24))
            .build();

        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), verificationToken);

        return RegisterResponse.builder()
            .message("Inscription réussie ! Vérifie ton email pour activer ton compte.")
            .email(user.getEmail())
            .build();
    }

    @Transactional
    public AuthResponse verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Lien de vérification invalide ou déjà utilisé."));

        if (user.getTokenExpiry() == null || user.getTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Ce lien de vérification a expiré. Demande un nouvel email de vérification.");
        }

        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setTokenExpiry(null);
        userRepository.save(user);

        String jwtToken = jwtTokenProvider.generateToken(user.getUsername());
        return AuthResponse.builder()
            .token(jwtToken)
            .tokenType("Bearer")
            .user(userMapper.toResponse(user))
            .build();
    }

    @Transactional
    public void resendVerification(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("Aucun compte trouvé avec cet email."));

        if (user.isEmailVerified()) {
            throw new IllegalStateException("Cet email est déjà vérifié. Tu peux te connecter.");
        }

        String verificationToken = UUID.randomUUID().toString();
        user.setVerificationToken(verificationToken);
        user.setTokenExpiry(LocalDateTime.now().plusHours(24));
        userRepository.save(user);

        emailService.sendVerificationEmail(user.getEmail(), verificationToken);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!user.isEmailVerified()) {
            throw new IllegalStateException("Vérifie ton adresse email avant de te connecter. Consulte ta boîte mail.");
        }

        String token = jwtTokenProvider.generateToken(user.getUsername());
        return AuthResponse.builder()
            .token(token)
            .tokenType("Bearer")
            .user(userMapper.toResponse(user))
            .build();
    }
}
