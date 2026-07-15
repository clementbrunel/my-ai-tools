package com.pronocore.repository;

import com.pronocore.entity.Forfeit;
import com.pronocore.entity.Sport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForfeitRepository extends JpaRepository<Forfeit, Long> {

    List<Forfeit> findByActiveTrue();

    List<Forfeit> findAllByOrderByIdAsc();

    List<Forfeit> findByCategory(String category);

    /** Active SHARED gages only (group_id IS NULL), optionally filtered by sport (null sport = no filter). */
    @Query("""
            SELECT f FROM Forfeit f
            WHERE f.active = true AND f.group IS NULL
              AND (:sport IS NULL OR f.sport IS NULL OR f.sport = :sport)
            ORDER BY f.id
            """)
    List<Forfeit> findActiveSharedForSport(@Param("sport") Sport sport);

    /**
     * Active gages visible to the given groups: shared ones (filtered by sport,
     * null sport = no filter) + those owned by the groups (never sport-filtered,
     * they already belong to a specific group).
     */
    @Query("""
            SELECT f FROM Forfeit f
            WHERE f.active = true
              AND (
                    (f.group IS NULL AND (:sport IS NULL OR f.sport IS NULL OR f.sport = :sport))
                    OR f.group.id IN :groupIds
                  )
            ORDER BY f.id
            """)
    List<Forfeit> findActiveVisibleToGroups(@Param("groupIds") List<Long> groupIds, @Param("sport") Sport sport);

    /** Active group-specific forfeits for a single group. */
    List<Forfeit> findByActiveTrueAndGroupIdOrderById(Long groupId);

    /** Pending (inactive, awaiting group admin approval) forfeits proposed for a group. */
    List<Forfeit> findByActiveFalseAndGroupIdOrderById(Long groupId);

    /** Returns [groupId, count] of pending forfeits across multiple groups (single batch query). */
    @Query("SELECT f.group.id, COUNT(f) FROM Forfeit f WHERE f.active = false AND f.group.id IN :groupIds GROUP BY f.group.id")
    List<Object[]> countPendingByGroupIds(@Param("groupIds") List<Long> groupIds);
}
