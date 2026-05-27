package com.pronocore.repository;

import com.pronocore.entity.BetParticipation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BetParticipationRepository extends JpaRepository<BetParticipation, Long> {

    List<BetParticipation> findByBetId(Long betId);

    List<BetParticipation> findByUserId(Long userId);

    Optional<BetParticipation> findByBetIdAndUserId(Long betId, Long userId);

    boolean existsByBetIdAndUserId(Long betId, Long userId);

    @Query("SELECT bp FROM BetParticipation bp WHERE bp.bet.id = :betId AND bp.chosenOption = :option")
    List<BetParticipation> findByBetIdAndChosenOption(@Param("betId") Long betId,
                                                      @Param("option") String option);

    /**
     * All settled participations for bets linked to matches on the given day.
     * Used to compute per-user daily points for the daily gage loser selection.
     */
    @Query("""
            SELECT bp FROM BetParticipation bp
            WHERE bp.bet.match.matchDate >= :startOfDay
              AND bp.bet.match.matchDate <  :endOfDay
              AND bp.bet.status = com.pronocore.entity.Bet.Status.VALIDATED
            """)
    List<BetParticipation> findSettledByMatchDay(@Param("startOfDay") LocalDateTime startOfDay,
                                                  @Param("endOfDay")   LocalDateTime endOfDay);
}
