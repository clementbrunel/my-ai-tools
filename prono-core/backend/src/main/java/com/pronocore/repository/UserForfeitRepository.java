package com.pronocore.repository;

import com.pronocore.entity.UserForfeit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserForfeitRepository extends JpaRepository<UserForfeit, Long> {

    List<UserForfeit> findByUserId(Long userId);

    List<UserForfeit> findByUserIdAndCompletedFalse(Long userId);

    List<UserForfeit> findByCompletedFalse();

    /** Number of gages received per user within a group (for the "Roi des gages" badge). */
    @Query("SELECT uf.user.id, COUNT(uf) FROM UserForfeit uf WHERE uf.group.id = :groupId GROUP BY uf.user.id")
    List<Object[]> countByGroupIdGroupedByUser(@Param("groupId") Long groupId);
}
