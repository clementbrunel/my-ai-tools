package com.pronocore.repository;

import com.pronocore.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u ORDER BY u.globalScore DESC, u.betsWon DESC")
    List<User> findAllOrderByGlobalScoreDesc();

    @Query("SELECT u FROM User u WHERE u.id IN (SELECT gm.user.id FROM GroupMember gm WHERE gm.group.id = :groupId) ORDER BY u.globalScore DESC, u.betsWon DESC")
    List<User> findAllByGroupIdOrderByGlobalScoreDesc(Long groupId);
}
