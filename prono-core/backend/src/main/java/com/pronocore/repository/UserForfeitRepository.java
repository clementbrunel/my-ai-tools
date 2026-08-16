package com.pronocore.repository;

import com.pronocore.entity.UserForfeit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserForfeitRepository extends JpaRepository<UserForfeit, Long> {

    @Query("SELECT uf FROM UserForfeit uf JOIN FETCH uf.user JOIN FETCH uf.forfeit JOIN FETCH uf.assignedBy WHERE uf.user.id = :userId")
    List<UserForfeit> findByUserId(@Param("userId") Long userId);

    @Query("SELECT uf FROM UserForfeit uf JOIN FETCH uf.user JOIN FETCH uf.forfeit JOIN FETCH uf.assignedBy WHERE uf.user.id = :userId AND uf.completed = false")
    List<UserForfeit> findByUserIdAndCompletedFalse(@Param("userId") Long userId);

    /** Number of gages received per user within a group (for the "Roi des gages" badge). */
    @Query("SELECT uf.user.id, COUNT(uf) FROM UserForfeit uf WHERE uf.group.id = :groupId GROUP BY uf.user.id")
    List<Object[]> countByGroupIdGroupedByUser(@Param("groupId") Long groupId);

    /**
     * Competition-filtered variant: only gages tied to a bet on that competition's matches
     * (FOOT) or races (F1) — narrows the leaderboard's "Gages" column the same way the points
     * and bets-won columns are narrowed by {@code competitionId}. Gages with no linked bet
     * (legacy/manual assignments) are excluded, since they can't be attributed to a competition.
     *
     * <p>The match/race joins must be explicit LEFT JOINs: a bet has either a match or a
     * race, never both, so implicit (inner) joins on both paths would drop every row.
     */
    @Query("""
            SELECT uf.user.id, COUNT(uf)
            FROM UserForfeit uf
            LEFT JOIN uf.bet b
            LEFT JOIN b.match m
            LEFT JOIN b.race r
            WHERE uf.group.id = :groupId
              AND ((m IS NOT NULL AND m.competition.id = :competitionId)
                OR (r IS NOT NULL AND r.competition.id = :competitionId))
            GROUP BY uf.user.id
            """)
    List<Object[]> countByGroupIdAndCompetitionGroupedByUser(@Param("groupId") Long groupId, @Param("competitionId") Long competitionId);

    /** All gage assignments for a group: pending first (by assignedAt desc), then completed (by completedAt desc). */
    @Query("SELECT uf FROM UserForfeit uf JOIN FETCH uf.user JOIN FETCH uf.forfeit JOIN FETCH uf.assignedBy WHERE uf.group.id = :groupId ORDER BY uf.completed ASC, CASE WHEN uf.completed = false THEN uf.assignedAt ELSE uf.completedAt END DESC")
    List<UserForfeit> findAllByGroupId(@Param("groupId") Long groupId);
}
