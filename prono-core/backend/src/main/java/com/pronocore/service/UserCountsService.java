package com.pronocore.service;

import com.pronocore.dto.response.UserCountsResponse;
import com.pronocore.entity.User;
import com.pronocore.repository.UserForfeitRepository;
import com.pronocore.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserCountsService {

    private final UserRepository userRepository;
    private final UserForfeitRepository userForfeitRepository;

    @Transactional(readOnly = true)
    public UserCountsResponse getCounts(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        int pendingGages = userForfeitRepository.findByUserIdAndCompletedFalse(user.getId()).size();

        return UserCountsResponse.builder()
                .pendingGages(pendingGages)
                .build();
    }
}
