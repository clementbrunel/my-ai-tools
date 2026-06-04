package com.pronocore.service;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.dto.response.UserForfeitResponse;
import com.pronocore.entity.Forfeit;
import com.pronocore.entity.User;
import com.pronocore.entity.UserForfeit;
import com.pronocore.repository.ForfeitRepository;
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

    private final ForfeitRepository    forfeitRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final UserRepository       userRepository;

    // ---------------------------------------------------------------
    // Forfeit library queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ForfeitResponse> getAllForfeits() {
        return forfeitRepository.findByActiveTrue().stream()
                .map(this::toForfeitResponse)
                .toList();
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
     * Any authenticated player proposes a new gage.
     * It is immediately visible to everyone (active=true, proposedBy=user).
     */
    @Transactional
    public ForfeitResponse proposeForfeit(String title, String description, String category) {
        String username = currentUsername();
        User proposer = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        Forfeit forfeit = Forfeit.builder()
                .title(title)
                .description(description)
                .category(category != null ? category : "General")
                .active(true)
                .proposedBy(proposer)
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
        boolean isAdmin = caller.getRole() == User.Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You can only complete your own gage");
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
