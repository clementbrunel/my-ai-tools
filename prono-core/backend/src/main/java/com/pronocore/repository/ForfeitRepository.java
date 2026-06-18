package com.pronocore.repository;

import com.pronocore.entity.Forfeit;
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

    /** Active SHARED gages only (group_id IS NULL). */
    List<Forfeit> findByActiveTrueAndGroupIsNullOrderById();

    /** Active gages visible to the given groups: shared ones + those owned by the groups. */
    @Query("""
            SELECT f FROM Forfeit f
            WHERE f.active = true AND (f.group IS NULL OR f.group.id IN :groupIds)
            ORDER BY f.id
            """)
    List<Forfeit> findActiveVisibleToGroups(@Param("groupIds") List<Long> groupIds);

    /** Active group-specific forfeits for a single group. */
    List<Forfeit> findByActiveTrueAndGroupIdOrderById(Long groupId);

    /** Pending (inactive, awaiting group admin approval) forfeits proposed for a group. */
    List<Forfeit> findByActiveFalseAndGroupIdOrderById(Long groupId);
}
