package com.pronocore.util;

import com.pronocore.entity.User;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;

/** Resolves the {@link User} behind a username or the current Spring Security principal. */
public final class CurrentUserLookup {

    private CurrentUserLookup() {
    }

    public static User require(UserRepository userRepository, String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
    }

    public static String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    public static User requireCurrent(UserRepository userRepository) {
        return require(userRepository, currentUsername());
    }

    public static User currentOrNull(UserRepository userRepository) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }
}
