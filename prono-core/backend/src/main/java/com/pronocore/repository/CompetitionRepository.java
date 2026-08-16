package com.pronocore.repository;

import com.pronocore.entity.Competition;
import com.pronocore.entity.Sport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    Optional<Competition> findByName(String name);

    List<Competition> findAllByOrderByNameAsc();

    List<Competition> findAllBySportInOrderByNameAsc(Collection<Sport> sports);

    Optional<Competition> findFirstBySportOrderByIdDesc(Sport sport);

    /** Active FOOT competitions wired to a football-data.org competition code — the score-sync poll's scope. */
    List<Competition> findBySportAndActiveTrueAndFootballDataCompetitionCodeIsNotNull(Sport sport);
}
