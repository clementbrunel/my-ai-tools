package com.pronocore.service;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeaderboardServiceTest {

    @Mock private UserRepository             userRepository;
    @Mock private BetParticipationRepository betParticipationRepository;
    @Mock private UserForfeitRepository      userForfeitRepository;
    @Mock private UserMapper                 userMapper;

    @InjectMocks
    private LeaderboardService leaderboardService;

    // ── getGroupLeaderboard ───────────────────────────────────────────────────

    @Test
    void getGroupLeaderboard_shouldAssignRanksBasedOnGroupPoints() {
        User alice = user(1L, "alice");
        User bob   = user(2L, "bob");

        // alice has 50 group pts, bob has 30 group pts
        Object[] aliceRow = { 1L, 50 };
        Object[] bobRow   = { 2L, 30 };

        when(userRepository.findAllByGroupId(42L))
                .thenReturn(new ArrayList<>(List.of(alice, bob)));
        when(betParticipationRepository.sumPointsEarnedByGroupId(42L))
                .thenReturn(List.of(aliceRow, bobRow));
        when(betParticipationRepository.countBetsWonByGroupId(42L))
                .thenReturn(List.of());
        when(userMapper.toResponse(alice)).thenReturn(userResponse(1L, "alice"));
        when(userMapper.toResponse(bob))  .thenReturn(userResponse(2L, "bob"));

        List<LeaderboardEntryResponse> result = leaderboardService.getGroupLeaderboard(42L);

        assertThat(result).hasSize(2);
        // alice has more group points → rank 1
        assertThat(result.get(0).getRank()).isEqualTo(1);
        assertThat(result.get(0).getUser().getUsername()).isEqualTo("alice");
        assertThat(result.get(0).getTotalPoints()).isEqualTo(50);
        assertThat(result.get(1).getRank()).isEqualTo(2);
    }

    @Test
    void getGroupLeaderboard_shouldUseBetsWonAsTiebreaker() {
        User alice = user(1L, "alice");
        User bob   = user(2L, "bob");

        // Both have same group points (20), but bob has more bets won
        Object[] aliceRow = { 1L, 20 };
        Object[] bobRow   = { 2L, 20 };
        Object[] aliceWon = { 1L, 5 };
        Object[] bobWon   = { 2L, 8 };

        when(userRepository.findAllByGroupId(42L))
                .thenReturn(new ArrayList<>(List.of(alice, bob)));
        when(betParticipationRepository.sumPointsEarnedByGroupId(42L))
                .thenReturn(List.of(aliceRow, bobRow));
        when(betParticipationRepository.countBetsWonByGroupId(42L))
                .thenReturn(List.of(aliceWon, bobWon));
        when(userMapper.toResponse(alice)).thenReturn(userResponse(1L, "alice"));
        when(userMapper.toResponse(bob))  .thenReturn(userResponse(2L, "bob"));

        List<LeaderboardEntryResponse> result = leaderboardService.getGroupLeaderboard(42L);

        // bob wins the tiebreak (more bets won)
        assertThat(result.get(0).getUser().getUsername()).isEqualTo("bob");
        assertThat(result.get(0).getBetsWon()).isEqualTo(8);
        assertThat(result.get(1).getUser().getUsername()).isEqualTo("alice");
    }

    @Test
    void getGroupLeaderboard_shouldReportForfeitsReceivedPerGroup() {
        User alice = user(1L, "alice");
        User bob   = user(2L, "bob");

        Object[] alicePts = { 1L, 50 };
        Object[] bobPts   = { 2L, 30 };
        Object[] aliceForfeits = { 1L, 2L };

        when(userRepository.findAllByGroupId(42L))
                .thenReturn(new ArrayList<>(List.of(alice, bob)));
        when(betParticipationRepository.sumPointsEarnedByGroupId(42L))
                .thenReturn(List.of(alicePts, bobPts));
        when(betParticipationRepository.countBetsWonByGroupId(42L)).thenReturn(List.of());
        // alice received 2 gages in THIS group, bob 0
        when(userForfeitRepository.countByGroupIdGroupedByUser(42L))
                .thenReturn(List.<Object[]>of(aliceForfeits));
        when(userMapper.toResponse(alice)).thenReturn(userResponse(1L, "alice"));
        when(userMapper.toResponse(bob)).thenReturn(userResponse(2L, "bob"));

        List<LeaderboardEntryResponse> result = leaderboardService.getGroupLeaderboard(42L);

        assertThat(result.get(0).getForfeitsReceived()).isEqualTo(2); // alice, per-group
        assertThat(result.get(1).getForfeitsReceived()).isEqualTo(0); // bob
    }

    @Test
    void getGroupLeaderboard_shouldDefaultToZeroForUsersWithNoGroupParticipation() {
        User alice = user(1L, "alice");

        // alice has no group-specific participation rows
        when(userRepository.findAllByGroupId(42L))
                .thenReturn(new ArrayList<>(List.of(alice)));
        when(betParticipationRepository.sumPointsEarnedByGroupId(42L)).thenReturn(List.of());
        when(betParticipationRepository.countBetsWonByGroupId(42L)).thenReturn(List.of());
        when(userMapper.toResponse(alice)).thenReturn(userResponse(1L, "alice"));

        List<LeaderboardEntryResponse> result = leaderboardService.getGroupLeaderboard(42L);

        assertThat(result.get(0).getTotalPoints()).isEqualTo(0);
        assertThat(result.get(0).getBetsWon()).isEqualTo(0);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User user(Long id, String username) {
        return User.builder()
                .id(id).username(username).email(username + "@test.com")
                .password("encoded").role(User.Role.USER)
                .build();
    }

    private UserResponse userResponse(Long id, String username) {
        return UserResponse.builder().id(id).username(username).build();
    }
}
