package com.pronocore.service;

import com.pronocore.dto.response.LeaderboardEntryResponse;
import com.pronocore.entity.Sport;
import com.pronocore.entity.User;
import com.pronocore.mapper.UserMapper;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import com.pronocore.util.RankingComparator;
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
        return getGroupLeaderboard(groupId, null, null);
    }

    /** sport = null → all points combined; FOOT/F1 → only that sport's bets. */
    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getGroupLeaderboard(Long groupId, Sport sport) {
        return getGroupLeaderboard(groupId, sport, null);
    }

    /**
     * competitionId, when given, narrows the leaderboard to bets on that single competition's
     * matches/races — e.g. reviewing an inactive competition's final ranking — and takes
     * priority over the broader sport filter.
     */
    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getGroupLeaderboard(Long groupId, Sport sport, Long competitionId) {
        List<User> members = userRepository.findAllByGroupId(groupId);

        List<Object[]> pointsRows = competitionId != null
            ? betParticipationRepository.sumPointsEarnedByGroupIdAndCompetition(groupId, competitionId)
            : sport == null
                ? betParticipationRepository.sumPointsEarnedByGroupId(groupId)
                : betParticipationRepository.sumPointsEarnedByGroupIdAndSport(groupId, sport == Sport.F1);
        Map<Long, Integer> pointsByUser = new HashMap<>();
        for (Object[] row : pointsRows) {
            pointsByUser.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }

        List<Object[]> betsWonRows = competitionId != null
            ? betParticipationRepository.countBetsWonByGroupIdAndCompetition(groupId, competitionId)
            : sport == null
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

        members.sort(Comparator.comparing(User::getId, RankingComparator.byPointsThenBetsWonDesc(pointsByUser, betsWonByUser)));

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
