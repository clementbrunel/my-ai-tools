package com.pronocore.service;

import com.pronocore.dto.response.AdminCountsResponse;
import com.pronocore.entity.Bet;
import com.pronocore.entity.DailyGage;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.User;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminCountsService {

    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ForfeitRepository forfeitRepository;
    private final BetRepository betRepository;
    private final DailyGageRepository dailyGageRepository;

    @Transactional(readOnly = true)
    public AdminCountsResponse getCounts(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        List<GroupMember> adminMemberships = groupMemberRepository
                .findByUserIdAndStatus(user.getId(), GroupMember.MemberStatus.ACTIVE).stream()
                .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
                .toList();

        if (adminMemberships.isEmpty()) {
            return AdminCountsResponse.builder()
                    .pendingApplications(0)
                    .pendingForfeitsPerGroup(Map.of())
                    .missingGagesPerGroup(Map.of())
                    .groupsWithNoBets(Map.of())
                    .matchesWithoutBetsPerGroup(Map.of())
                    .build();
        }

        List<Long> adminGroupIds = adminMemberships.stream()
                .map(m -> m.getGroup().getId())
                .toList();

        // pendingApplications
        int pendingApplications = adminGroupIds.stream()
                .mapToInt(gid -> (int) groupMemberRepository.countByGroupIdAndStatus(gid, GroupMember.MemberStatus.PENDING))
                .sum();

        // pendingForfeitsPerGroup
        Map<Long, Integer> pendingForfeitsPerGroup = adminGroupIds.stream()
                .collect(Collectors.toMap(
                        gid -> gid,
                        gid -> forfeitRepository.findByActiveFalseAndGroupIdOrderById(gid).size()
                ));

        // missingGagesPerGroup — only counts days that have at least one OPEN bet in the group
        Map<Long, Set<LocalDate>> configuredDatesPerGroup = dailyGageRepository
                .findByGroupIdInOrderByMatchDateDesc(adminGroupIds).stream()
                .filter(dg -> dg.getMode() == DailyGage.Mode.VOTE || dg.getForfeit() != null)
                .collect(Collectors.groupingBy(
                        dg -> dg.getGroup().getId(),
                        Collectors.mapping(DailyGage::getMatchDate, Collectors.toSet())
                ));

        Map<Long, Integer> missingGagesPerGroup = adminGroupIds.stream()
                .collect(Collectors.toMap(
                        gid -> gid,
                        gid -> {
                            List<LocalDate> datesWithOpenBets = betRepository
                                    .findDistinctMatchesWithOpenBetsForGroup(gid).stream()
                                    .map(m -> m.getMatchDate().toLocalDate())
                                    .distinct()
                                    .toList();
                            Set<LocalDate> configured = configuredDatesPerGroup.getOrDefault(gid, Set.of());
                            return (int) datesWithOpenBets.stream()
                                    .filter(d -> !configured.contains(d))
                                    .count();
                        }
                ));

        // groupsWithNoBets
        Map<Long, Boolean> groupsWithNoBets = adminGroupIds.stream()
                .collect(Collectors.toMap(
                        gid -> gid,
                        gid -> !betRepository.existsByGroupIdAndStatus(gid, Bet.Status.OPEN)
                ));

        // matchesWithoutBetsPerGroup — UPCOMING matches not yet opened to betting in the group
        Map<Long, Integer> matchesWithoutBetsPerGroup = adminGroupIds.stream()
                .collect(Collectors.toMap(
                        gid -> gid,
                        gid -> (int) betRepository.countUpcomingMatchesWithoutBetsForGroup(gid)
                ));

        return AdminCountsResponse.builder()
                .pendingApplications(pendingApplications)
                .pendingForfeitsPerGroup(pendingForfeitsPerGroup)
                .missingGagesPerGroup(missingGagesPerGroup)
                .groupsWithNoBets(groupsWithNoBets)
                .matchesWithoutBetsPerGroup(matchesWithoutBetsPerGroup)
                .build();
    }
}
