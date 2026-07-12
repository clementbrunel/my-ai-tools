package com.pronocore.repository;

import com.pronocore.entity.F1Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface F1PredictionRepository extends JpaRepository<F1Prediction, Long> {

    Optional<F1Prediction> findByParticipationId(Long participationId);

    /** Bulk delete of every prediction attached to a bet's participations. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM F1Prediction p WHERE p.participation.bet.id = :betId")
    void deleteByBetId(@Param("betId") Long betId);

    /** All predictions for every bet of a race (settlement + participants list). */
    @Query("""
            SELECT p FROM F1Prediction p
            JOIN FETCH p.participation bp
            JOIN FETCH bp.user
            JOIN FETCH p.p1 JOIN FETCH p.p2 JOIN FETCH p.p3
            LEFT JOIN FETCH p.pole LEFT JOIN FETCH p.fastestLap LEFT JOIN FETCH p.lastClassified
            WHERE bp.bet.race.id = :raceId
            """)
    List<F1Prediction> findByRaceId(@Param("raceId") Long raceId);

    /** The user's prediction for a race — one per (bet, user), possibly one per group. */
    @Query("""
            SELECT p FROM F1Prediction p
            JOIN FETCH p.p1 JOIN FETCH p.p2 JOIN FETCH p.p3
            LEFT JOIN FETCH p.pole LEFT JOIN FETCH p.fastestLap LEFT JOIN FETCH p.lastClassified
            WHERE p.participation.bet.race.id = :raceId
              AND p.participation.user.id = :userId
            """)
    List<F1Prediction> findByRaceIdAndUserId(@Param("raceId") Long raceId, @Param("userId") Long userId);
}
