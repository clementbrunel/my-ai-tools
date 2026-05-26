package com.pronocore.repository;

import com.pronocore.entity.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    List<Match> findByStatusOrderByMatchDateAsc(Match.Status status);

    List<Match> findAllByOrderByMatchDateAsc();
}
