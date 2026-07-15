package com.pronocore.repository;

import com.pronocore.entity.RaceResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {

    @Query("SELECT rr FROM RaceResult rr JOIN FETCH rr.driver d JOIN FETCH d.constructor WHERE rr.race.id = :raceId ORDER BY rr.position ASC NULLS LAST")
    List<RaceResult> findByRaceIdWithDrivers(@Param("raceId") Long raceId);

    void deleteByRaceId(Long raceId);

    /** All results of FINISHED races of a competition — feeds the standings. */
    @Query("""
            SELECT rr FROM RaceResult rr
            JOIN FETCH rr.driver d
            JOIN FETCH d.constructor
            WHERE rr.race.competition.id = :competitionId
              AND rr.race.status = com.pronocore.entity.Race.Status.FINISHED
            """)
    List<RaceResult> findByCompetitionIdWithDrivers(@Param("competitionId") Long competitionId);

    /** A driver's results across a competition's finished races, most recent first — feeds the driver detail page. */
    @Query("""
            SELECT rr FROM RaceResult rr
            JOIN FETCH rr.race r
            WHERE rr.driver.id = :driverId
              AND r.competition.id = :competitionId
              AND r.status = com.pronocore.entity.Race.Status.FINISHED
            ORDER BY r.raceDate DESC
            """)
    List<RaceResult> findByDriverIdAndCompetitionIdWithRace(@Param("driverId") Long driverId,
                                                             @Param("competitionId") Long competitionId);
}
