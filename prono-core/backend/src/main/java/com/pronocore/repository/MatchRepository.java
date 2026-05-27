package com.pronocore.repository;

import com.pronocore.entity.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    List<Match> findByStatusOrderByMatchDateAsc(Match.Status status);

    List<Match> findAllByOrderByMatchDateAsc();

    /** All matches whose kick-off falls on the same calendar day as [startOfDay, endOfDay). */
    @Query("SELECT m FROM Match m WHERE m.matchDate >= :startOfDay AND m.matchDate < :endOfDay")
    List<Match> findByMatchDay(@Param("startOfDay") LocalDateTime startOfDay,
                               @Param("endOfDay")   LocalDateTime endOfDay);

    /** Count matches on a given day that are not yet FINISHED. */
    @Query("""
            SELECT COUNT(m) FROM Match m
            WHERE m.matchDate >= :startOfDay AND m.matchDate < :endOfDay
              AND m.status <> :finishedStatus
            """)
    long countUnfinishedMatchesOnDay(@Param("startOfDay")     LocalDateTime startOfDay,
                                     @Param("endOfDay")       LocalDateTime endOfDay,
                                     @Param("finishedStatus") Match.Status  finishedStatus);
}
