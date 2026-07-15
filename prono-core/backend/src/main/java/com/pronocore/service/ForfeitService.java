package com.pronocore.service;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.GroupUserForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
import com.pronocore.entity.Forfeit;
import com.pronocore.entity.ForfeitVote;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.Sport;
import com.pronocore.entity.User;
import com.pronocore.entity.UserForfeit;
import com.pronocore.repository.ForfeitRepository;
import com.pronocore.repository.ForfeitVoteRepository;
import com.pronocore.repository.GroupMemberRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ForfeitService {

    private final ForfeitRepository      forfeitRepository;
    private final ForfeitVoteRepository  forfeitVoteRepository;
    private final UserForfeitRepository  userForfeitRepository;
    private final UserRepository         userRepository;
    private final GroupMemberRepository  groupMemberRepository;
    private final GroupMemberGuard       groupMemberGuard;

    // ---------------------------------------------------------------
    // Forfeit library queries
    // ---------------------------------------------------------------

    /**
     * Library visible to the caller: shared gages (group=null, filtered by sport
     * when given — null sport = no filter) plus the gages owned by the groups the
     * caller is an ACTIVE member of.
     */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getForfeitsForUser(String username, Sport sport) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        List<Long> groupIds = groupMemberRepository
                .findByUserIdAndStatus(user.getId(), GroupMember.MemberStatus.ACTIVE).stream()
                .map(m -> m.getGroup().getId())
                .toList();

        List<Forfeit> visible = groupIds.isEmpty()
                ? forfeitRepository.findActiveSharedForSport(sport)
                : forfeitRepository.findActiveVisibleToGroups(groupIds, sport);

        return toForfeitResponsesForUser(visible, user.getId());
    }

    @Transactional(readOnly = true)
    public List<ForfeitResponse> getAllForfeitsAdmin() {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        return toForfeitResponsesForUser(forfeitRepository.findAllByOrderByIdAsc(), user.getId());
    }

    // ---------------------------------------------------------------
    // Forfeit library commands
    // ---------------------------------------------------------------

    /** Admin creates a gage (no proposedBy). Null sport = generic, shown regardless of sport. */
    @Transactional
    public ForfeitResponse createForfeit(String title, String description, String category, Sport sport) {
        Forfeit forfeit = Forfeit.builder()
                .title(title)
                .description(description)
                .category(category)
                .sport(sport)
                .active(true)
                .build();
        return toForfeitResponse(forfeitRepository.save(forfeit));
    }

    /**
     * A player proposes a new gage inside one of their groups.
     * It is kept private to that group (group=groupId) and immediately visible
     * to the group's members.
     */
    @Transactional
    public ForfeitResponse proposeForfeit(Long groupId, String title, String description, String category) {
        String username = currentUsername();
        User proposer = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        GroupMember member = groupMemberGuard.requireActiveMembership(groupId, proposer.getId());
        Group group = member.getGroup();
        boolean isAdmin = member.getRole() == GroupMember.GroupRole.GROUP_ADMIN;

        Forfeit forfeit = Forfeit.builder()
                .title(title)
                .description(description)
                .category(category != null ? category : "General")
                .active(isAdmin)
                .proposedBy(proposer)
                .group(group)
                .build();
        return toForfeitResponse(forfeitRepository.save(forfeit));
    }

    /** Admin updates title, description, category and sport of any forfeit. */
    @Transactional
    public ForfeitResponse updateForfeit(Long forfeitId, String title, String description, String category, Sport sport) {
        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));
        forfeit.setTitle(title);
        forfeit.setDescription(description);
        forfeit.setCategory(category);
        forfeit.setSport(sport);
        return toForfeitResponse(forfeitRepository.save(forfeit));
    }

    /** Admin soft-deletes a gage (isActive=false). */
    @Transactional
    public void deleteForfeit(Long forfeitId) {
        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));
        forfeit.setActive(false);
        forfeitRepository.save(forfeit);
    }

    // ---------------------------------------------------------------
    // Group-admin gage management
    // ---------------------------------------------------------------

    /** Returns shared forfeits + active forfeits owned by this group (for forfeit selection UI). */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getForfeitsVisibleToGroup(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        GroupMember member = groupMemberGuard.requireActiveMembership(groupId, user.getId());

        // A group playing a single sport filters shared gages to that sport;
        // a multi-sport group sees the full shared library (no single filter applies).
        Set<Sport> groupSports = member.getGroup().getSports();
        Sport sportFilter = groupSports.size() == 1 ? groupSports.iterator().next() : null;

        return toForfeitResponsesForUser(
                forfeitRepository.findActiveVisibleToGroups(List.of(groupId), sportFilter), user.getId());
    }

    /** Returns active group-specific forfeits (visible to any group member). */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getGroupForfeits(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return toForfeitResponsesForUser(
                forfeitRepository.findByActiveTrueAndGroupIdOrderById(groupId), user.getId());
    }

    /** Returns pending (inactive) proposed forfeits for a group (group admin only). */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getGroupPendingForfeits(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireGroupAdmin(groupId, user.getId());
        return toForfeitResponsesForUser(
                forfeitRepository.findByActiveFalseAndGroupIdOrderById(groupId), user.getId());
    }

    /** Group admin approves a proposed forfeit (sets active=true). */
    @Transactional
    public ForfeitResponse approveGroupForfeit(Long groupId, Long forfeitId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireGroupAdmin(groupId, user.getId());

        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));
        if (forfeit.getGroup() == null || !forfeit.getGroup().getId().equals(groupId)) {
            throw new AccessDeniedException("This forfeit does not belong to group " + groupId);
        }
        forfeit.setActive(true);
        return toForfeitResponse(forfeitRepository.save(forfeit));
    }

    /** Group admin rejects/deletes a group forfeit (hard-delete). */
    @Transactional
    public void deleteGroupForfeit(Long groupId, Long forfeitId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireGroupAdmin(groupId, user.getId());

        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));
        if (forfeit.getGroup() == null || !forfeit.getGroup().getId().equals(groupId)) {
            throw new AccessDeniedException("This forfeit does not belong to group " + groupId);
        }
        forfeitRepository.delete(forfeit);
    }

    // ---------------------------------------------------------------
    // Manual assignment (admin)
    // ---------------------------------------------------------------

    @Transactional
    public void assignForfeit(Long userId, Long forfeitId, Long assignedById) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));
        User assignedBy = userRepository.findById(assignedById)
                .orElseThrow(() -> new EntityNotFoundException("Assigner not found: " + assignedById));

        UserForfeit userForfeit = UserForfeit.builder()
                .user(user)
                .forfeit(forfeit)
                .assignedBy(assignedBy)
                .completed(false)
                .build();
        userForfeitRepository.save(userForfeit);
    }

    // ---------------------------------------------------------------
    // Completion
    // ---------------------------------------------------------------

    /**
     * Marks a user forfeit as completed.
     * The sanctioned player can mark their own; admins can mark anyone's.
     */
    @Transactional
    public void completeForfeit(Long userForfeitId) {
        UserForfeit uf = userForfeitRepository.findById(userForfeitId)
                .orElseThrow(() -> new EntityNotFoundException("UserForfeit not found: " + userForfeitId));

        String username = currentUsername();
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        boolean isOwner = uf.getUser().getId().equals(caller.getId());
        boolean isAdmin = caller.getRole() == User.Role.PLATFORM_ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You can only complete your own gage");
        }

        // Idempotence: completing an already-completed gage must not inflate
        // the global timesCompleted counter on the forfeit template.
        if (uf.isCompleted()) {
            return;
        }

        uf.setCompleted(true);
        uf.setCompletedAt(LocalDateTime.now());
        userForfeitRepository.save(uf);

        // Increment the global completed counter on the forfeit template
        Forfeit forfeit = uf.getForfeit();
        forfeit.setTimesCompleted(forfeit.getTimesCompleted() + 1);
        forfeitRepository.save(forfeit);
    }

    // ---------------------------------------------------------------
    // User gages queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<UserForfeitResponse> getUserForfeits(Long userId) {
        return userForfeitRepository.findByUserId(userId).stream()
                .map(this::toUserForfeitResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserForfeitResponse> getPendingForfeits(Long userId) {
        return userForfeitRepository.findByUserIdAndCompletedFalse(userId).stream()
                .map(this::toUserForfeitResponse)
                .toList();
    }

    /** Returns all gage assignments for all members of a group, pending first then completed (any group member can call this). */
    @Transactional(readOnly = true)
    public List<GroupUserForfeitResponse> getGroupAssignments(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return userForfeitRepository.findAllByGroupId(groupId).stream()
                .map(this::toGroupUserForfeitResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserForfeitResponse> getMyForfeits() {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        return getUserForfeits(user.getId());
    }

    // ---------------------------------------------------------------
    // Voting
    // ---------------------------------------------------------------

    /**
     * Cast, change, or remove the current user's vote on a forfeit from the library.
     * Any authenticated user can vote on shared forfeits; for group forfeits, the
     * user must be an active member of that group.
     */
    @Transactional
    public ForfeitResponse voteForfeit(Long forfeitId, int voteValue) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        Forfeit forfeit = forfeitRepository.findById(forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + forfeitId));

        if (forfeit.getGroup() != null) {
            groupMemberGuard.requireActiveMembership(forfeit.getGroup().getId(), user.getId());
        }

        if (voteValue == 0) {
            forfeitVoteRepository.deleteByForfeitIdAndUserId(forfeitId, user.getId());
        } else {
            if (voteValue != 1 && voteValue != -1) {
                throw new IllegalArgumentException("Vote must be -1, 0, or +1");
            }
            forfeitVoteRepository.upsertVote(forfeitId, user.getId(), voteValue);
        }

        return toForfeitResponsesForUser(List.of(forfeit), user.getId()).get(0);
    }

    // ---------------------------------------------------------------
    // Mapping helpers
    // ---------------------------------------------------------------

    /** Bulk-enriches a list of forfeits with vote scores and the caller's own votes. */
    private List<ForfeitResponse> toForfeitResponsesForUser(List<Forfeit> forfeits, Long userId) {
        if (forfeits.isEmpty()) return List.of();

        List<Long> ids = forfeits.stream().map(Forfeit::getId).toList();

        Map<Long, Integer> scores = forfeitVoteRepository.sumVoteScoresByForfeitIds(ids).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).intValue()));

        Map<Long, Integer> userVotes = forfeitVoteRepository.findByForfeitIdInAndUserId(ids, userId).stream()
                .collect(Collectors.toMap(v -> v.getForfeit().getId(), ForfeitVote::getVote));

        return forfeits.stream()
                .map(f -> toForfeitResponse(f,
                        scores.getOrDefault(f.getId(), 0),
                        userVotes.getOrDefault(f.getId(), 0)))
                .toList();
    }

    ForfeitResponse toForfeitResponse(Forfeit f) {
        return toForfeitResponse(f, 0, 0);
    }

    private ForfeitResponse toForfeitResponse(Forfeit f, int voteScore, int userVote) {
        return ForfeitResponse.builder()
                .id(f.getId())
                .title(f.getTitle())
                .description(f.getDescription())
                .category(f.getCategory())
                .isActive(f.isActive())
                .timesCompleted(f.getTimesCompleted())
                .proposedByUsername(f.getProposedBy() != null ? f.getProposedBy().getUsername() : null)
                .proposedByDisplayName(f.getProposedBy() != null ? f.getProposedBy().getDisplayName() : null)
                .groupId(f.getGroup() != null ? f.getGroup().getId() : null)
                .groupName(f.getGroup() != null ? f.getGroup().getName() : null)
                .sport(f.getSport())
                .voteScore(voteScore)
                .userVote(userVote)
                .build();
    }

    private UserForfeitResponse toUserForfeitResponse(UserForfeit uf) {
        return UserForfeitResponse.builder()
                .id(uf.getId())
                .forfeit(toForfeitResponse(uf.getForfeit()))
                .assignedByUsername(uf.getAssignedBy().getUsername())
                .assignedByDisplayName(uf.getAssignedBy().getDisplayName())
                .completed(uf.isCompleted())
                .completedAt(uf.getCompletedAt())
                .assignedAt(uf.getAssignedAt())
                .build();
    }

    private GroupUserForfeitResponse toGroupUserForfeitResponse(UserForfeit uf) {
        return GroupUserForfeitResponse.builder()
                .id(uf.getId())
                .username(uf.getUser().getUsername())
                .displayName(uf.getUser().getDisplayName())
                .avatarUrl(uf.getUser().getEffectiveAvatarUrl())
                .forfeit(toForfeitResponse(uf.getForfeit()))
                .assignedByUsername(uf.getAssignedBy().getUsername())
                .assignedByDisplayName(uf.getAssignedBy().getDisplayName())
                .completed(uf.isCompleted())
                .completedAt(uf.getCompletedAt())
                .assignedAt(uf.getAssignedAt())
                .build();
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
