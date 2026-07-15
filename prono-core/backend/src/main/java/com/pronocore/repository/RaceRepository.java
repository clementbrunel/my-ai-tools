package com.pronocore.repository;

import com.pronocore.entity.Race;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RaceRepository extends JpaRepository<Race, Long> {

    List<Race> findAllByOrderByRaceDateAsc();

    List<Race> findByCompetition_IdOrderByRaceDateAsc(Long competitionId);

    /** Races of the day whose results are not entered yet — blocks daily gage settlement. */
    @Query("""
            SELECT COUNT(r) FROM Race r
            WHERE r.raceDate >= :start AND r.raceDate < :end
              AND r.status <> com.pronocore.entity.Race.Status.FINISHED
            """)
    long countUnfinishedRacesOnDay(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** [raceDate, status] pairs in a range — batched "day fully finished" checks. */
    @Query("SELECT r.raceDate, r.status FROM Race r WHERE r.raceDate >= :start AND r.raceDate < :end")
    List<Object[]> findRaceDatesAndStatusesInRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** Upcoming races whose start falls in [from, to] and for which no reminder has been sent yet. */
    @Query("""
            SELECT r FROM Race r
            WHERE r.status = com.pronocore.entity.Race.Status.UPCOMING
              AND r.reminderSent = false
              AND r.raceDate >= :from
              AND r.raceDate <= :to
            """)
    List<Race> findUpcomingRacesForReminder(@Param("from") LocalDateTime from,
                                            @Param("to")   LocalDateTime to);

    /** All UPCOMING races today (in [startOfDay, endOfDay)) that have at least one OPEN bet
     *  in one of the user's ACTIVE groups and on which the user has not yet predicted.
     *  Only races that have not yet started (raceDate > now) are returned. */
    @Query("""
            SELECT DISTINCT r FROM Race r
            JOIN Bet b ON b.race = r
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND r.status = com.pronocore.entity.Race.Status.UPCOMING
              AND r.raceDate >= :startOfDay
              AND r.raceDate < :endOfDay
              AND r.raceDate > :now
              AND NOT EXISTS (
                  SELECT bp FROM BetParticipation bp
                  WHERE bp.bet.race = r AND bp.user.id = :userId
              )
            ORDER BY r.raceDate ASC
            """)
    List<Race> findPendingRacesTodayForUser(@Param("userId")     Long          userId,
                                            @Param("startOfDay") LocalDateTime startOfDay,
                                            @Param("endOfDay")   LocalDateTime endOfDay,
                                            @Param("now")        LocalDateTime now);
}
