package com.pronocore.repository;

import com.pronocore.entity.Bet;
import com.pronocore.entity.BetParticipation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface BetParticipationRepository extends JpaRepository<BetParticipation, Long> {

    List<BetParticipation> findByBetId(Long betId);

    List<BetParticipation> findByUserId(Long userId);

    Optional<BetParticipation> findByBetIdAndUserId(Long betId, Long userId);

    boolean existsByBetIdAndUserId(Long betId, Long userId);

    @Query("SELECT bp FROM BetParticipation bp WHERE bp.bet.id = :betId AND bp.chosenOption = :option")
    List<BetParticipation> findByBetIdAndChosenOption(@Param("betId") Long betId,
                                                      @Param("option") String option);

    @Query("""
            SELECT bp.user.id, COALESCE(SUM(bp.pointsEarned), 0)
            FROM BetParticipation bp
            WHERE bp.bet.group.id = :groupId AND bp.bet.status = 'VALIDATED'
            GROUP BY bp.user.id
            """)
    List<Object[]> sumPointsEarnedByGroupId(@Param("groupId") Long groupId);

    @Query("""
            SELECT bp.user.id, COUNT(bp)
            FROM BetParticipation bp
            WHERE bp.bet.group.id = :groupId AND bp.bet.status = 'VALIDATED' AND bp.pointsEarned > 0
            GROUP BY bp.user.id
            """)
    List<Object[]> countBetsWonByGroupId(@Param("groupId") Long groupId);

    /**
     * All settled participations for bets linked to matches on the given day.
     * Used to compute per-user daily points for the daily gage loser selection.
     */
    @Query("""
            SELECT bp.bet.group.id, bp.user.id, COALESCE(SUM(bp.pointsEarned), 0)
            FROM BetParticipation bp
            WHERE bp.bet.group.id IN :groupIds AND bp.bet.status = 'VALIDATED'
            GROUP BY bp.bet.group.id, bp.user.id
            """)
    List<Object[]> sumPointsByGroupIds(@Param("groupIds") List<Long> groupIds);

    @Query("""
            SELECT bp FROM BetParticipation bp
            WHERE bp.bet.match.matchDate >= :startOfDay
              AND bp.bet.match.matchDate <  :endOfDay
              AND bp.bet.status = :validatedStatus
            """)
    List<BetParticipation> findSettledByMatchDay(@Param("startOfDay")      LocalDateTime startOfDay,
                                                  @Param("endOfDay")        LocalDateTime endOfDay,
                                                  @Param("validatedStatus") Bet.Status    validatedStatus);

    /** Settled participations for a single group's bets on the given day (daily gage loser). */
    @Query("""
            SELECT bp FROM BetParticipation bp
            WHERE bp.bet.match.matchDate >= :startOfDay
              AND bp.bet.match.matchDate <  :endOfDay
              AND bp.bet.status = :validatedStatus
              AND bp.bet.group.id = :groupId
            """)
    List<BetParticipation> findSettledByMatchDayAndGroup(@Param("startOfDay")      LocalDateTime startOfDay,
                                                          @Param("endOfDay")        LocalDateTime endOfDay,
                                                          @Param("validatedStatus") Bet.Status    validatedStatus,
                                                          @Param("groupId")         Long          groupId);

    @Query("SELECT DISTINCT bp.bet.match.id FROM BetParticipation bp WHERE bp.user.id = :userId AND bp.bet.match IS NOT NULL")
    Set<Long> findParticipatedMatchIdsByUserId(@Param("userId") Long userId);

    /** True if the user has already placed at least one bet for the given match (across any group). */
    @Query("""
            SELECT COUNT(bp) > 0 FROM BetParticipation bp
            WHERE bp.user.id = :userId AND bp.bet.match.id = :matchId
            """)
    boolean existsByUserIdAndMatchId(@Param("userId") Long userId, @Param("matchId") Long matchId);

    /** All participations a user has for a given match, across all groups. */
    @Query("""
            SELECT bp FROM BetParticipation bp
            WHERE bp.user.id = :userId AND bp.bet.match.id = :matchId
            """)
    List<BetParticipation> findByUserIdAndMatchId(@Param("userId") Long userId,
                                                   @Param("matchId") Long matchId);

    /** Participations a user has in a given group for past matches, ordered by match date desc. */
    @Query("""
            SELECT bp FROM BetParticipation bp
            JOIN FETCH bp.bet b
            JOIN FETCH b.match m
            WHERE bp.user.id = :userId AND b.group.id = :groupId
              AND m.matchDate < :now
            ORDER BY m.matchDate DESC
            """)
    List<BetParticipation> findByUserIdAndGroupId(@Param("userId") Long userId,
                                                   @Param("groupId") Long groupId,
                                                   @Param("now") java.time.LocalDateTime now);
}
