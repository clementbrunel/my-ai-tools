package com.pronocore.service;

import com.pronocore.dto.response.UserAdminResponse;
import com.pronocore.dto.response.UserGroupSummary;
import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        return userMapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + id));
        return userMapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
            .map(userMapper::toResponse)
            .toList();
    }

    @Transactional
    public UserResponse updateDisplayName(String username, String displayName) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        user.setDisplayName(displayName.isBlank() ? null : displayName.trim());
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateAvatar(String username, String avatarUrl) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        user.setAvatarUrl(avatarUrl);
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Transactional
    public void updatePassword(String username, String currentPassword, String newPassword) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            log.warn("Password change failed — wrong current password for user: {}", username);
            throw new IllegalArgumentException("Mot de passe actuel incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Transactional
    public UserResponse updateEmail(String username, String newEmail) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        if (!newEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("Cette adresse email est déjà utilisée");
        }
        user.setEmail(newEmail.toLowerCase().trim());
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateEmailPreferences(String username, boolean reminderEnabled, boolean gageEnabled) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        user.setEmailReminderEnabled(reminderEnabled);
        user.setEmailGageEnabled(gageEnabled);
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserAdminResponse> getAllUsersWithGroups() {
        List<User> users = userRepository.findAll();
        List<GroupMember> allMembers = groupMemberRepository.findAllWithGroupAndUser();

        Map<Long, List<UserGroupSummary>> groupsByUserId = allMembers.stream()
            .collect(Collectors.groupingBy(
                gm -> gm.getUser().getId(),
                Collectors.mapping(gm -> UserGroupSummary.builder()
                    .groupId(gm.getGroup().getId())
                    .groupName(gm.getGroup().getName())
                    .role(gm.getRole())
                    .status(gm.getStatus())
                    .joinedAt(gm.getJoinedAt())
                    .build(),
                Collectors.toList())
            ));

        return users.stream()
            .map(user -> UserAdminResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .emailVerified(user.isEmailVerified())
                .role(user.getRole())
                .avatarUrl(user.getEffectiveAvatarUrl())
                .createdAt(user.getCreatedAt())
                .groups(groupsByUserId.getOrDefault(user.getId(), List.of()))
                .build())
            .sorted(Comparator.comparing(UserAdminResponse::getCreatedAt,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    /**
     * Admin: force emailVerified=true and optionally set a new password.
     * Fixes users stuck in a loop because their email was never verified
     * (password resets don't flip emailVerified, so the login endpoint kept returning 401).
     */
    @Transactional
    public UserResponse adminUnlockUser(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));
        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setTokenExpiry(null);
        if (newPassword != null && !newPassword.isBlank()) {
            user.setPassword(passwordEncoder.encode(newPassword));
        }
        userRepository.save(user);
        return userMapper.toResponse(user);
    }

    public User findByUsername(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }
}
