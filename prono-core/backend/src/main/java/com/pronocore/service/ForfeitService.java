package com.pronocore.service;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.entity.Forfeit;
import com.pronocore.entity.User;
import com.pronocore.entity.UserForfeit;
import com.pronocore.repository.ForfeitRepository;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ForfeitService {

    private final ForfeitRepository forfeitRepository;
    private final UserForfeitRepository userForfeitRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ForfeitResponse> getAllForfeits() {
        return forfeitRepository.findByActiveTrue().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ForfeitResponse> getAllForfeitsAdmin() {
        return forfeitRepository.findAll().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public ForfeitResponse createForfeit(String title, String description, String category) {
        Forfeit forfeit = Forfeit.builder()
            .title(title)
            .description(description)
            .category(category)
            .active(true)
            .build();
        return toResponse(forfeitRepository.save(forfeit));
    }

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

    @Transactional
    public void completeForfeit(Long userForfeitId) {
        UserForfeit userForfeit = userForfeitRepository.findById(userForfeitId)
            .orElseThrow(() -> new EntityNotFoundException("UserForfeit not found: " + userForfeitId));
        userForfeit.setCompleted(true);
        userForfeitRepository.save(userForfeit);
    }

    @Transactional(readOnly = true)
    public List<UserForfeit> getUserForfeits(Long userId) {
        return userForfeitRepository.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<UserForfeit> getPendingForfeits(Long userId) {
        return userForfeitRepository.findByUserIdAndCompletedFalse(userId);
    }

    private ForfeitResponse toResponse(Forfeit forfeit) {
        return ForfeitResponse.builder()
            .id(forfeit.getId())
            .title(forfeit.getTitle())
            .description(forfeit.getDescription())
            .category(forfeit.getCategory())
            .isActive(forfeit.isActive())
            .build();
    }
}
