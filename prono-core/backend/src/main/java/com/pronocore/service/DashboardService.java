package com.pronocore.service;

import com.pronocore.dto.response.DashboardStatsResponse;
import com.pronocore.dto.response.GroupRankResponse;
import com.pronocore.entity.Bet;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.User;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final BetRepository betRepository;
    private final BetParticipationRepository betParticipationRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public DashboardStatsResponse getStats(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // Query 1: distinct upcoming matches with OPEN bets in user's groups
        long upcomingCount = betRepository.countDistinctUpcomingMatchesInUserGroups(
                user.getId(), Bet.Status.OPEN, Match.Status.UPCOMING);

        // Query 2: all group memberships for the user (with group info)
        List<GroupMember> userMemberships = groupMemberRepository.findByUserId(user.getId());
        List<Long> groupIds = userMemberships.stream()
                .map(gm -> gm.getGroup().getId())
                .collect(Collectors.toList());

        List<GroupRankResponse> groupRanks = new ArrayList<>();
        if (!groupIds.isEmpty()) {
            // Query 3: all members across all the user's groups
            List<GroupMember> allMembers = groupMemberRepository.findByGroupIdIn(groupIds);

            // Query 4: sum of points per (groupId, userId) from validated bets
            Map<Long, Map<Long, Integer>> pointsByGroupAndUser = new HashMap<>();
            for (Object[] row : betParticipationRepository.sumPointsByGroupIds(groupIds)) {
                Long groupId = ((Number) row[0]).longValue();
                Long userId  = ((Number) row[1]).longValue();
                int  points  = ((Number) row[2]).intValue();
                pointsByGroupAndUser
                        .computeIfAbsent(groupId, k -> new HashMap<>())
                        .put(userId, points);
            }

            // Group members by groupId
            Map<Long, List<GroupMember>> membersByGroup = allMembers.stream()
                    .collect(Collectors.groupingBy(gm -> gm.getGroup().getId()));

            for (GroupMember membership : userMemberships) {
                Long groupId   = membership.getGroup().getId();
                String groupName = membership.getGroup().getName();
                Map<Long, Integer> groupPoints = pointsByGroupAndUser.getOrDefault(groupId, Map.of());
                List<GroupMember> members = membersByGroup.getOrDefault(groupId, List.of());

                // Sort member IDs by their points descending to determine rank
                List<Long> ranked = members.stream()
                        .map(gm -> gm.getUser().getId())
                        .sorted(Comparator.comparingInt(
                                (Long uid) -> groupPoints.getOrDefault(uid, 0)).reversed())
                        .collect(Collectors.toList());

                int userPoints = groupPoints.getOrDefault(user.getId(), 0);
                int rank = ranked.indexOf(user.getId()) + 1;

                groupRanks.add(GroupRankResponse.builder()
                        .groupId(groupId)
                        .groupName(groupName)
                        .rank(rank)
                        .total(members.size())
                        .points(userPoints)
                        .build());
            }
        }

        return DashboardStatsResponse.builder()
                .upcomingMatchesInMyGroups(upcomingCount)
                .groupRanks(groupRanks)
                .build();
    }
}
