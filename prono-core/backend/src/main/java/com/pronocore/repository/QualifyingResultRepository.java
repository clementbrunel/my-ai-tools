package com.pronocore.repository;

import com.pronocore.entity.QualifyingResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QualifyingResultRepository extends JpaRepository<QualifyingResult, Long> {

    @Query("""
            SELECT qr FROM QualifyingResult qr
            JOIN FETCH qr.driver d
            JOIN FETCH d.constructor
            WHERE qr.race.id = :raceId
            ORDER BY qr.position ASC
            """)
    List<QualifyingResult> findByRaceIdWithDrivers(@Param("raceId") Long raceId);

    void deleteByRaceId(Long raceId);
}
