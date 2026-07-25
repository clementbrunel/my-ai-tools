package com.pronocore.service;

import com.pronocore.dto.response.GroupAdminCountsResponse;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.dto.response.RaceResponse;
import com.pronocore.entity.DailyGage;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Match;
import com.pronocore.entity.Race;
import com.pronocore.entity.User;
import com.pronocore.entity.Sport;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.mapper.RaceMapper;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.DailyGageRepository;
import com.pronocore.repository.ForfeitRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.GroupRepository;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Everything a GROUP_ADMIN (not to be confused with PLATFORM_ADMIN) can do:
 * membership moderation, group settings, notifying members of new matches/races,
 * and the aggregated badge counts shown in the admin navbar.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GroupAdminService {

    private final GroupService groupService;
    private final GroupMemberGuard groupMemberGuard;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final BetRepository betRepository;
    private final ForfeitRepository forfeitRepository;
    private final DailyGageRepository dailyGageRepository;
    private final MatchMapper matchMapper;
    private final RaceMapper raceMapper;
    private final EmailService emailService;

    @Transactional
    public GroupMemberResponse approveApplication(Long groupId, Long targetUserId, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        GroupMember application = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        if (application.getStatus() != GroupMember.MemberStatus.PENDING) {
            throw new IllegalStateException("This user is already an active member");
        }

        application.setStatus(GroupMember.MemberStatus.ACTIVE);
        groupMemberRepository.save(application);
        log.info("User {} approved into group {} by {}", targetUserId, groupId, adminUsername);
        return groupService.toMemberResponse(application);
    }

    @Transactional
    public void rejectApplication(Long groupId, Long targetUserId, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        GroupMember application = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        if (application.getStatus() != GroupMember.MemberStatus.PENDING) {
            throw new IllegalStateException("This user is already an active member");
        }

        groupMemberRepository.delete(application);
        log.info("User {} rejected from group {} by {}", targetUserId, groupId, adminUsername);
    }

    @Transactional
    public GroupResponse updatePrivacy(Long groupId, boolean isPrivate, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        Group group = groupService.findGroup(groupId);
        group.setPrivate(isPrivate);
        groupRepository.save(group);

        return groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional
    public GroupResponse updateInfo(Long groupId, String name, String description, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        Group group = groupService.findGroup(groupId);
        group.setName(name.trim());
        group.setDescription(description != null && !description.isBlank() ? description.trim() : null);
        groupRepository.save(group);

        return groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional
    public GroupResponse updateInviteCode(Long groupId, String requestedCode, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);

        Group group = groupService.findGroup(groupId);
        if (requestedCode == null || requestedCode.isBlank()) {
            group.setInviteCode(groupService.generateUniqueCode());
        } else {
            String normalized = requestedCode.trim().toUpperCase();
            if (!normalized.matches("[A-Z0-9]{4,20}")) {
                throw new IllegalArgumentException("Le code d'invitation doit contenir entre 4 et 20 lettres/chiffres");
            }
            if (!normalized.equals(group.getInviteCode()) && groupRepository.existsByInviteCode(normalized)) {
                throw new IllegalStateException("Ce code d'invitation est déjà utilisé");
            }
            group.setInviteCode(normalized);
        }
        groupRepository.save(group);

        return groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional
    public GroupResponse updateSports(Long groupId, Set<Sport> sports, String adminUsername) {
        assertGroupAdmin(groupId, adminUsername);
        if (sports == null || sports.isEmpty()) {
            throw new IllegalArgumentException("Un groupe doit jouer à au moins un sport");
        }

        Group group = groupService.findGroup(groupId);
        group.getSports().clear();
        group.getSports().addAll(sports);
        groupRepository.save(group);

        return groupService.toResponse(group, GroupMember.GroupRole.GROUP_ADMIN, true);
    }

    @Transactional
    public GroupMemberResponse promoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));
        if (member.getStatus() != GroupMember.MemberStatus.ACTIVE) {
            throw new IllegalStateException("Cannot promote a pending applicant");
        }
        member.setRole(GroupMember.GroupRole.GROUP_ADMIN);
        groupMemberRepository.save(member);
        log.info("User {} promoted to admin in group {} by {}", targetUserId, groupId, requesterUsername);
        return groupService.toMemberResponse(member);
    }

    @Transactional
    public GroupMemberResponse demoteMember(Long groupId, Long targetUserId, String requesterUsername) {
        assertGroupAdmin(groupId, requesterUsername);

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));

        long adminCount = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
            .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
            .count();
        if (adminCount == 1) {
            throw new IllegalStateException("Cannot demote: at least one admin must remain.");
        }

        member.setRole(GroupMember.GroupRole.MEMBER);
        groupMemberRepository.save(member);
        log.info("User {} demoted to member in group {} by {}", targetUserId, groupId, requesterUsername);
        return groupService.toMemberResponse(member);
    }

    @Transactional
    public void removeMember(Long groupId, Long targetUserId, String requesterUsername) {
        User requester = groupService.findUser(requesterUsername);
        assertGroupAdmin(groupId, requesterUsername);

        if (requester.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("Use 'leave group' to remove yourself");
        }

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new IllegalArgumentException("User is not a member of this group"));

        if (member.getRole() == GroupMember.GroupRole.GROUP_ADMIN) {
            long adminCount = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
                .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
                .count();
            if (adminCount == 1) {
                throw new IllegalStateException("Cannot remove: at least one admin must remain.");
            }
        }

        groupMemberRepository.delete(member);
        log.info("User {} removed from group {} by {}", targetUserId, groupId, requesterUsername);
    }

    /** Future matches (kick-off not yet passed) open for pronostics in this group. */
    @Transactional(readOnly = true)
    public List<MatchResponse> getFutureOpenMatches(Long groupId, String username) {
        assertGroupAdmin(groupId, username);
        return betRepository.findFutureDistinctMatchesWithOpenBetsForGroup(groupId, LocalDateTime.now()).stream()
            .map(matchMapper::toResponse)
            .toList();
    }

    /** Notify all active members of the group that the given future open matches were added. */
    @Transactional(readOnly = true)
    public void notifyNewMatches(Long groupId, List<Long> matchIds, String leaderUsername) {
        User leader = groupService.findUser(leaderUsername);
        assertGroupAdmin(groupId, leaderUsername);
        Group group = groupService.findGroup(groupId);

        Set<Long> requestedIds = Set.copyOf(matchIds);
        List<Match> matches = betRepository.findFutureDistinctMatchesWithOpenBetsForGroup(groupId, LocalDateTime.now()).stream()
            .filter(m -> requestedIds.contains(m.getId()))
            .toList();
        if (matches.isEmpty()) {
            throw new IllegalArgumentException("No matching future open matches found for this group");
        }

        List<User> recipients = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
            .map(GroupMember::getUser)
            .toList();

        for (User recipient : recipients) {
            emailService.sendGroupNewMatchesEmail(recipient, group.getName(), leader, matches);
        }
        log.info("Group {} leader {} notified {} member(s) about {} new match(es)",
            groupId, leaderUsername, recipients.size(), matches.size());
    }

    /** Future races (start not yet passed) open for pronostics in this group. */
    @Transactional(readOnly = true)
    public List<RaceResponse> getFutureOpenRaces(Long groupId, String username) {
        assertGroupAdmin(groupId, username);
        return betRepository.findFutureDistinctRacesWithOpenBetsForGroup(groupId, LocalDateTime.now()).stream()
            .map(raceMapper::toResponse)
            .toList();
    }

    /** Notify all active members of the group that the given future open races were added. */
    @Transactional(readOnly = true)
    public void notifyNewRaces(Long groupId, List<Long> raceIds, String leaderUsername) {
        User leader = groupService.findUser(leaderUsername);
        assertGroupAdmin(groupId, leaderUsername);
        Group group = groupService.findGroup(groupId);

        Set<Long> requestedIds = Set.copyOf(raceIds);
        List<Race> races = betRepository.findFutureDistinctRacesWithOpenBetsForGroup(groupId, LocalDateTime.now()).stream()
            .filter(r -> requestedIds.contains(r.getId()))
            .toList();
        if (races.isEmpty()) {
            throw new IllegalArgumentException("No matching future open races found for this group");
        }

        List<User> recipients = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.MemberStatus.ACTIVE).stream()
            .map(GroupMember::getUser)
            .toList();

        for (User recipient : recipients) {
            emailService.sendGroupNewRacesEmail(recipient, group.getName(), leader, races);
        }
        log.info("Group {} leader {} notified {} member(s) about {} new race(s)",
            groupId, leaderUsername, recipients.size(), races.size());
    }

    /** Aggregated badge counts (pending applications, missing gages, etc.) across all groups the user administers. */
    @Transactional(readOnly = true)
    public GroupAdminCountsResponse getCounts(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        List<GroupMember> adminMemberships = groupMemberRepository
            .findByUserIdAndStatus(user.getId(), GroupMember.MemberStatus.ACTIVE).stream()
            .filter(m -> m.getRole() == GroupMember.GroupRole.GROUP_ADMIN)
            .toList();

        if (adminMemberships.isEmpty()) {
            return GroupAdminCountsResponse.builder()
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

        // pendingApplications — single batch query instead of N
        int pendingApplications = groupMemberRepository.countPendingByGroupIds(adminGroupIds).stream()
            .mapToInt(row -> ((Number) row[1]).intValue())
            .sum();

        // pendingForfeitsPerGroup — single batch query instead of N; default to 0 for groups with no rows
        Map<Long, Integer> pendingForfeitsCounts = forfeitRepository.countPendingByGroupIds(adminGroupIds).stream()
            .collect(Collectors.toMap(
                row -> (Long) row[0],
                row -> ((Number) row[1]).intValue()
            ));
        Map<Long, Integer> pendingForfeitsPerGroup = adminGroupIds.stream()
            .collect(Collectors.toMap(
                gid -> gid,
                gid -> pendingForfeitsCounts.getOrDefault(gid, 0)
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

        // groupsWithNoBets — single batch query instead of N
        Set<Long> groupsWithOpenBets = betRepository.findGroupIdsWithOpenBets(adminGroupIds).stream()
            .collect(Collectors.toSet());
        Map<Long, Boolean> groupsWithNoBets = adminGroupIds.stream()
            .collect(Collectors.toMap(
                gid -> gid,
                gid -> !groupsWithOpenBets.contains(gid)
            ));

        // matchesWithoutBetsPerGroup — UPCOMING matches not yet opened to betting in the group
        Map<Long, Integer> matchesWithoutBetsPerGroup = adminGroupIds.stream()
            .collect(Collectors.toMap(
                gid -> gid,
                gid -> (int) betRepository.countUpcomingMatchesWithoutBetsForGroup(gid)
            ));

        return GroupAdminCountsResponse.builder()
            .pendingApplications(pendingApplications)
            .pendingForfeitsPerGroup(pendingForfeitsPerGroup)
            .missingGagesPerGroup(missingGagesPerGroup)
            .groupsWithNoBets(groupsWithNoBets)
            .matchesWithoutBetsPerGroup(matchesWithoutBetsPerGroup)
            .build();
    }

    // -------------------------------------------------------------------------

    private void assertGroupAdmin(Long groupId, String username) {
        Long userId = groupService.findUser(username).getId();
        groupMemberGuard.requireGroupAdmin(groupId, userId);
    }
}
