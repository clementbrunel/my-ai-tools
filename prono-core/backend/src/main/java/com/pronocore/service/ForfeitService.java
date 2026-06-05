package com.pronocore.service;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
import com.pronocore.entity.Forfeit;
import com.pronocore.entity.Group;
import com.pronocore.entity.GroupMember;
import com.pronocore.entity.User;
import com.pronocore.entity.UserForfeit;
import com.pronocore.repository.ForfeitRepository;
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

@Service
@RequiredArgsConstructor
public class ForfeitService {

    private final ForfeitRepository      forfeitRepository;
    private final UserForfeitRepository  userForfeitRepository;
    private final UserRepository         userRepository;
    private final GroupMemberRepository  groupMemberRepository;
    private final GroupMemberGuard       groupMemberGuard;

    // ---------------------------------------------------------------
    // Forfeit library queries
    // ---------------------------------------------------------------

    /**
     * Library visible to the caller: shared gages (group=null) plus the gages
     * owned by the groups the caller is an ACTIVE member of.
     */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getForfeitsForUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        List<Long> groupIds = groupMemberRepository
                .findByUserIdAndStatus(user.getId(), GroupMember.MemberStatus.ACTIVE).stream()
                .map(m -> m.getGroup().getId())
                .toList();

        List<Forfeit> visible = groupIds.isEmpty()
                ? forfeitRepository.findByActiveTrueAndGroupIsNullOrderById()
                : forfeitRepository.findActiveVisibleToGroups(groupIds);

        return visible.stream().map(this::toForfeitResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ForfeitResponse> getAllForfeitsAdmin() {
        return forfeitRepository.findAll().stream()
                .map(this::toForfeitResponse)
                .toList();
    }

    // ---------------------------------------------------------------
    // Forfeit library commands
    // ---------------------------------------------------------------

    /** Admin creates a gage (no proposedBy). */
    @Transactional
    public ForfeitResponse createForfeit(String title, String description, String category) {
        Forfeit forfeit = Forfeit.builder()
                .title(title)
                .description(description)
                .category(category)
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
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return forfeitRepository.findActiveVisibleToGroups(List.of(groupId))
                .stream().map(this::toForfeitResponse).toList();
    }

    /** Returns active group-specific forfeits (visible to any group member). */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getGroupForfeits(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireActiveMembership(groupId, user.getId());
        return forfeitRepository.findByActiveTrueAndGroupIdOrderById(groupId)
                .stream().map(this::toForfeitResponse).toList();
    }

    /** Returns pending (inactive) proposed forfeits for a group (group admin only). */
    @Transactional(readOnly = true)
    public List<ForfeitResponse> getGroupPendingForfeits(Long groupId) {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        groupMemberGuard.requireGroupAdmin(groupId, user.getId());
        return forfeitRepository.findByActiveFalseAndGroupIdOrderById(groupId)
                .stream().map(this::toForfeitResponse).toList();
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

        user.setForfeitsReceived(user.getForfeitsReceived() + 1);
        userRepository.save(user);

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

    @Transactional(readOnly = true)
    public List<UserForfeitResponse> getMyForfeits() {
        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        return getUserForfeits(user.getId());
    }

    // ---------------------------------------------------------------
    // Mapping helpers
    // ---------------------------------------------------------------

    ForfeitResponse toForfeitResponse(Forfeit f) {
        return ForfeitResponse.builder()
                .id(f.getId())
                .title(f.getTitle())
                .description(f.getDescription())
                .category(f.getCategory())
                .isActive(f.isActive())
                .timesCompleted(f.getTimesCompleted())
                .proposedByUsername(f.getProposedBy() != null ? f.getProposedBy().getUsername() : null)
                .groupId(f.getGroup() != null ? f.getGroup().getId() : null)
                .groupName(f.getGroup() != null ? f.getGroup().getName() : null)
                .build();
    }

    private UserForfeitResponse toUserForfeitResponse(UserForfeit uf) {
        return UserForfeitResponse.builder()
                .id(uf.getId())
                .forfeit(toForfeitResponse(uf.getForfeit()))
                .assignedByUsername(uf.getAssignedBy().getUsername())
                .completed(uf.isCompleted())
                .completedAt(uf.getCompletedAt())
                .assignedAt(uf.getAssignedAt())
                .build();
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
