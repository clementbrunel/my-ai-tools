package com.pronocore.service;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeaderboardServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserMapper     userMapper;

    @InjectMocks
    private LeaderboardService leaderboardService;

    // ── getLeaderboard ────────────────────────────────────────────────────────

    @Test
    void getLeaderboard_shouldAssignRanksStartingAtOne() {
        User first  = user(1L, "alice",  100, 10, 0);
        User second = user(2L, "bob",     80,  8, 1);
        User third  = user(3L, "charlie", 60,  5, 2);

        // Repository returns users already sorted by score DESC
        when(userRepository.findAllOrderByGlobalScoreDesc())
                .thenReturn(List.of(first, second, third));
        when(userMapper.toResponse(first))  .thenReturn(userResponse(1L, "alice"));
        when(userMapper.toResponse(second)) .thenReturn(userResponse(2L, "bob"));
        when(userMapper.toResponse(third))  .thenReturn(userResponse(3L, "charlie"));

        List<LeaderboardEntryResponse> result = leaderboardService.getLeaderboard();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getRank()).isEqualTo(1);
        assertThat(result.get(1).getRank()).isEqualTo(2);
        assertThat(result.get(2).getRank()).isEqualTo(3);
    }

    @Test
    void getLeaderboard_shouldMapScoresBetsWonAndForfeitsCorrectly() {
        User user = user(1L, "alice", 100, 10, 3);

        when(userRepository.findAllOrderByGlobalScoreDesc()).thenReturn(List.of(user));
        when(userMapper.toResponse(user)).thenReturn(userResponse(1L, "alice"));

        List<LeaderboardEntryResponse> result = leaderboardService.getLeaderboard();

        LeaderboardEntryResponse entry = result.get(0);
        assertThat(entry.getTotalPoints()).isEqualTo(100);
        assertThat(entry.getBetsWon()).isEqualTo(10);
        assertThat(entry.getForfeitsReceived()).isEqualTo(3);
        assertThat(entry.getUser().getUsername()).isEqualTo("alice");
    }

    @Test
    void getLeaderboard_shouldReturnEmptyListWhenNoUsers() {
        when(userRepository.findAllOrderByGlobalScoreDesc()).thenReturn(List.of());

        List<LeaderboardEntryResponse> result = leaderboardService.getLeaderboard();

        assertThat(result).isEmpty();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User user(Long id, String username, int score, int betsWon, int forfeits) {
        return User.builder()
                .id(id).username(username).email(username + "@test.com")
                .password("encoded").role(User.Role.USER)
                .globalScore(score).betsWon(betsWon).forfeitsReceived(forfeits)
                .build();
    }

    private UserResponse userResponse(Long id, String username) {
        return UserResponse.builder().id(id).username(username).build();
    }
}
