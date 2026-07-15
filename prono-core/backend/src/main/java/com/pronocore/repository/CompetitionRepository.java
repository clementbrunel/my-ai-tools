package com.pronocore.repository;

import com.pronocore.entity.Competition;
import com.pronocore.entity.Sport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    Optional<Competition> findByName(String name);

    List<Competition> findAllByOrderByNameAsc();

    Optional<Competition> findFirstBySportOrderByIdDesc(Sport sport);
}
