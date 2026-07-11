package com.pronocore.repository;

import com.pronocore.entity.Race;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RaceRepository extends JpaRepository<Race, Long> {

    List<Race> findAllByOrderByRaceDateAsc();

    List<Race> findByCompetition_IdOrderByRaceDateAsc(Long competitionId);
}
