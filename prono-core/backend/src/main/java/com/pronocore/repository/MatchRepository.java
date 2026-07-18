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

    @Query("SELECT m FROM Match m JOIN FETCH m.teamA JOIN FETCH m.teamB JOIN FETCH m.competition WHERE m.status = :status ORDER BY m.matchDate ASC")
    List<Match> findByStatusOrderByMatchDateAsc(@Param("status") Match.Status status);

    @Query("SELECT m FROM Match m JOIN FETCH m.teamA JOIN FETCH m.teamB JOIN FETCH m.competition ORDER BY m.matchDate ASC")
    List<Match> findAllByOrderByMatchDateAsc();

    @Query("SELECT m FROM Match m JOIN FETCH m.teamA JOIN FETCH m.teamB JOIN FETCH m.competition WHERE m.competition.id = :competitionId ORDER BY m.matchDate ASC")
    List<Match> findByCompetition_IdOrderByMatchDateAsc(@Param("competitionId") Long competitionId);

    @Query("""
            SELECT m FROM Match m JOIN FETCH m.teamA JOIN FETCH m.teamB JOIN FETCH m.competition
            WHERE m.teamA.id = :teamId OR m.teamB.id = :teamId
            ORDER BY m.matchDate DESC
            """)
    List<Match> findByTeam_IdOrderByMatchDateDesc(@Param("teamId") Long teamId);

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

    /** Kick-off datetime + status of every match in [start, end) — used to batch-compute
     *  "all matches finished" per calendar day for a whole list of gages in a single query. */
    @Query("SELECT m.matchDate, m.status FROM Match m WHERE m.matchDate >= :start AND m.matchDate < :end")
    List<Object[]> findMatchDatesAndStatusesInRange(@Param("start") LocalDateTime start,
                                                     @Param("end")   LocalDateTime end);

    /** Matches eligible for auto-sync: not FINISHED, not sync-locked, kick-off in [from, to]. */
    @Query("""
            SELECT m FROM Match m JOIN FETCH m.teamA JOIN FETCH m.teamB JOIN FETCH m.competition
            LEFT JOIN FETCH m.externalLinks
            WHERE m.status <> com.pronocore.entity.Match.Status.FINISHED
              AND m.syncLocked = false
              AND m.matchDate >= :from
              AND m.matchDate <= :to
            """)
    List<Match> findSyncableMatchesInWindow(@Param("from") LocalDateTime from,
                                             @Param("to")   LocalDateTime to);

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

    /** All UPCOMING matches today (in [startOfDay, endOfDay)) that have at least one OPEN bet
     *  in one of the user's ACTIVE groups and on which the user has not yet participated.
     *  Only matches that have not yet kicked off (matchDate > now) are returned, so a match
     *  whose status was not yet flipped to ONGOING/FINISHED by the admin is not included. */
    @Query("""
            SELECT DISTINCT m FROM Match m
            JOIN FETCH m.teamA
            JOIN FETCH m.teamB
            JOIN FETCH m.competition
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
