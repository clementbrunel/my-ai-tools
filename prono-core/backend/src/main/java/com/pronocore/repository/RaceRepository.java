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
}
