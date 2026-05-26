package com.pronocore.repository;

import com.pronocore.entity.UserForfeit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserForfeitRepository extends JpaRepository<UserForfeit, Long> {

    List<UserForfeit> findByUserId(Long userId);

    List<UserForfeit> findByUserIdAndCompletedFalse(Long userId);

    List<UserForfeit> findByCompletedFalse();
}
