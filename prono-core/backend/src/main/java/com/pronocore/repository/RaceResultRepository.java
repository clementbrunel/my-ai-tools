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
}
