package com.pronocore.service;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.entity.Sport;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final UserRepository userRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final UserMapper userMapper;

    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getGroupLeaderboard(Long groupId) {
        return getGroupLeaderboard(groupId, null);
    }

    /** sport = null → all points combined; FOOT/F1 → only that sport's bets. */
    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getGroupLeaderboard(Long groupId, Sport sport) {
        List<User> members = userRepository.findAllByGroupId(groupId);

        List<Object[]> pointsRows = sport == null
            ? betParticipationRepository.sumPointsEarnedByGroupId(groupId)
            : betParticipationRepository.sumPointsEarnedByGroupIdAndSport(groupId, sport == Sport.F1);
        Map<Long, Integer> pointsByUser = new HashMap<>();
        for (Object[] row : pointsRows) {
            pointsByUser.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }

        List<Object[]> betsWonRows = sport == null
            ? betParticipationRepository.countBetsWonByGroupId(groupId)
            : betParticipationRepository.countBetsWonByGroupIdAndSport(groupId, sport == Sport.F1);
        Map<Long, Integer> betsWonByUser = new HashMap<>();
        for (Object[] row : betsWonRows) {
            betsWonByUser.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }

        Map<Long, Integer> forfeitsByUser = new HashMap<>();
        for (Object[] row : userForfeitRepository.countByGroupIdGroupedByUser(groupId)) {
            forfeitsByUser.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }

        members.sort(Comparator
            .comparingInt((User u) -> -pointsByUser.getOrDefault(u.getId(), 0))
            .thenComparingInt(u -> -betsWonByUser.getOrDefault(u.getId(), 0)));

        List<LeaderboardEntryResponse> leaderboard = new ArrayList<>();
        for (int i = 0; i < members.size(); i++) {
            User user = members.get(i);
            leaderboard.add(LeaderboardEntryResponse.builder()
                .rank(i + 1)
                .user(userMapper.toResponse(user))
                .betsWon(betsWonByUser.getOrDefault(user.getId(), 0))
                .totalPoints(pointsByUser.getOrDefault(user.getId(), 0))
                .forfeitsReceived(forfeitsByUser.getOrDefault(user.getId(), 0))
                .build());
        }
        return leaderboard;
    }
}
