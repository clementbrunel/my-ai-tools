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

    List<Match> findByCompetitionOrderByMatchDateAsc(String competition);

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

    /** Distinct competition names that still have at least one non-FINISHED match. */
    @Query("SELECT DISTINCT m.competition FROM Match m WHERE m.status <> com.pronocore.entity.Match.Status.FINISHED ORDER BY m.competition ASC")
    List<String> findActiveCompetitions();

    /** Upcoming matches whose kick-off falls in [from, to] and for which no reminder has been sent yet. */
    @Query("""
            SELECT m FROM Match m
            WHERE m.status = com.pronocore.entity.Match.Status.UPCOMING
              AND m.reminderSent = false
              AND m.matchDate >= :from
              AND m.matchDate <= :to
            """)
    List<Match> findUpcomingMatchesForReminder(@Param("from") LocalDateTime from,
                                               @Param("to")   LocalDateTime to);

    /** Non-FINISHED, non-sync-locked matches whose kick-off falls in the given window. */
    @Query("""
            SELECT m FROM Match m
            WHERE m.status <> com.pronocore.entity.Match.Status.FINISHED
              AND m.syncLocked = false
              AND m.matchDate >= :from
              AND m.matchDate <= :to
            """)
    List<Match> findSyncableMatchesInWindow(@Param("from") LocalDateTime from,
                                            @Param("to")   LocalDateTime to);

    java.util.Optional<Match> findByExternalFixtureId(Long externalFixtureId);

    /** All UPCOMING matches today (in [startOfDay, endOfDay)) that have at least one OPEN bet
     *  in one of the user's ACTIVE groups and on which the user has not yet participated.
     *  Only matches that have not yet kicked off (matchDate > now) are returned, so a match
     *  whose status was not yet flipped to ONGOING/FINISHED by the admin is not included. */
    @Query("""
            SELECT DISTINCT m FROM Match m
            JOIN Bet b ON b.match = m
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND m.status = com.pronocore.entity.Match.Status.UPCOMING
              AND m.matchDate >= :startOfDay
              AND m.matchDate < :endOfDay
              AND m.matchDate > :now
              AND NOT EXISTS (
                  SELECT bp FROM BetParticipation bp
                  WHERE bp.bet.match = m AND bp.user.id = :userId
              )
            ORDER BY m.matchDate ASC
            """)
    List<Match> findPendingMatchesTodayForUser(@Param("userId")     Long          userId,
                                               @Param("startOfDay") LocalDateTime startOfDay,
                                               @Param("endOfDay")   LocalDateTime endOfDay,
                                               @Param("now")        LocalDateTime now);
}
