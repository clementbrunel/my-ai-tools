package com.pronocore.service;

import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserMapper     userMapper;

    @InjectMocks
    private UserService userService;

    private User testUser;
    private UserResponse testUserResponse;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L).username("alice").email("alice@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(50).betsWon(5).forfeitsReceived(1)
                .build();

        testUserResponse = UserResponse.builder()
                .id(1L).username("alice").email("alice@test.com")
                .role(User.Role.USER).globalScore(50).betsWon(5).forfeitsReceived(1)
                .build();
    }

    // ── getCurrentUser ────────────────────────────────────────────────────────

    @Test
    void getCurrentUser_shouldReturnMappedUserForKnownUsername() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(testUser));
        when(userMapper.toResponse(testUser)).thenReturn(testUserResponse);

        UserResponse result = userService.getCurrentUser("alice");

        assertThat(result.getUsername()).isEqualTo("alice");
        assertThat(result.getGlobalScore()).isEqualTo(50);
    }

    @Test
    void getCurrentUser_shouldThrowWhenUsernameNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getCurrentUser("ghost"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("ghost");
    }

    // ── getUserById ───────────────────────────────────────────────────────────

    @Test
    void getUserById_shouldReturnMappedUserForKnownId() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(userMapper.toResponse(testUser)).thenReturn(testUserResponse);

        UserResponse result = userService.getUserById(1L);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getUsername()).isEqualTo("alice");
    }

    @Test
    void getUserById_shouldThrowWhenIdNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(999L))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    // ── getAllUsers ───────────────────────────────────────────────────────────

    @Test
    void getAllUsers_shouldReturnAllUsersMapped() {
        User second = User.builder()
                .id(2L).username("bob").email("bob@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(30).betsWon(3).forfeitsReceived(0)
                .build();
        UserResponse secondResponse = UserResponse.builder().id(2L).username("bob").build();

        when(userRepository.findAll()).thenReturn(List.of(testUser, second));
        when(userMapper.toResponse(testUser)).thenReturn(testUserResponse);
        when(userMapper.toResponse(second)).thenReturn(secondResponse);

        List<UserResponse> result = userService.getAllUsers();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(UserResponse::getUsername)
                .containsExactly("alice", "bob");
    }

    // ── updateAvatar ──────────────────────────────────────────────────────────

    @Test
    void updateAvatar_shouldPersistNewAvatarUrl() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(testUser));
        when(userMapper.toResponse(testUser)).thenReturn(testUserResponse);

        userService.updateAvatar("alice", "https://example.com/avatar.png");

        assertThat(testUser.getAvatarUrl()).isEqualTo("https://example.com/avatar.png");
        verify(userRepository).save(testUser);
    }

    @Test
    void updateAvatar_shouldThrowWhenUserNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateAvatar("ghost", "https://example.com/avatar.png"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
