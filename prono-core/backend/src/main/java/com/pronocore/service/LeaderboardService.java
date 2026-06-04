package com.pronocore.service;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getLeaderboard() {
        List<User> users = userRepository.findAllOrderByGlobalScoreDesc();
        List<LeaderboardEntryResponse> leaderboard = new ArrayList<>();

        for (int i = 0; i < users.size(); i++) {
            User user = users.get(i);
            leaderboard.add(LeaderboardEntryResponse.builder()
                .rank(i + 1)
                .user(userMapper.toResponse(user))
                .betsWon(user.getBetsWon())
                .totalPoints(user.getGlobalScore())
                .forfeitsReceived(user.getForfeitsReceived())
                .build());
        }

        return leaderboard;
    }
}
