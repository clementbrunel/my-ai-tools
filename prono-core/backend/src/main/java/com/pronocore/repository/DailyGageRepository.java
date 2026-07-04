package com.pronocore.repository;

import com.pronocore.entity.DailyGage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyGageRepository extends JpaRepository<DailyGage, Long> {

    /** All groups' gages for a given day (used by auto-settlement). */
    @Query("SELECT DISTINCT dg FROM DailyGage dg JOIN FETCH dg.group WHERE dg.matchDate = :date")
    List<DailyGage> findByMatchDate(@Param("date") LocalDate date);

    @Query("SELECT dg FROM DailyGage dg JOIN FETCH dg.group WHERE dg.group.id = :groupId AND dg.matchDate = :date")
    Optional<DailyGage> findByGroupIdAndMatchDate(@Param("groupId") Long groupId, @Param("date") LocalDate date);

    /** The given groups' gages for a day (caller's groups). */
    @Query("""
            SELECT DISTINCT dg FROM DailyGage dg
            JOIN FETCH dg.group
            LEFT JOIN FETCH dg.forfeit
            LEFT JOIN FETCH dg.assignedTo
            LEFT JOIN FETCH dg.candidates c
            LEFT JOIN FETCH c.forfeit
            WHERE dg.matchDate = :date AND dg.group.id IN :groupIds
            """)
    List<DailyGage> findByMatchDateAndGroupIdIn(@Param("date") LocalDate date, @Param("groupIds") List<Long> groupIds);

    @Query("""
            SELECT DISTINCT dg FROM DailyGage dg
            JOIN FETCH dg.group
            LEFT JOIN FETCH dg.forfeit
            LEFT JOIN FETCH dg.assignedTo
            LEFT JOIN FETCH dg.candidates c
            LEFT JOIN FETCH c.forfeit
            WHERE dg.group.id IN :groupIds
            ORDER BY dg.matchDate DESC
            """)
    List<DailyGage> findByGroupIdInOrderByMatchDateDesc(@Param("groupIds") List<Long> groupIds);

    /** Single gage with group, forfeit, assignedTo and candidates+their forfeits pre-loaded. */
    @Query("""
            SELECT DISTINCT dg FROM DailyGage dg
            JOIN FETCH dg.group
            LEFT JOIN FETCH dg.forfeit
            LEFT JOIN FETCH dg.assignedTo
            LEFT JOIN FETCH dg.candidates c
            LEFT JOIN FETCH c.forfeit
            WHERE dg.id = :id
            """)
    Optional<DailyGage> findByIdWithDetails(@Param("id") Long id);
}
