package com.pronocore.repository;

import com.pronocore.entity.CompetitionTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompetitionTeamRepository extends JpaRepository<CompetitionTeam, Long> {

    List<CompetitionTeam> findByCompetitionOrderByTeamNameAsc(String competition);

    Optional<CompetitionTeam> findByCompetitionAndTeamName(String competition, String teamName);

    boolean existsByCompetitionAndTeamName(String competition, String teamName);

    void deleteByCompetitionAndTeamName(String competition, String teamName);

    /** All distinct competition names that have at least one row in this table. */
    @Query("SELECT DISTINCT ct.competition FROM CompetitionTeam ct ORDER BY ct.competition ASC")
    List<String> findAllDistinctCompetitions();

    /** All distinct team names across every competition in this table. */
    @Query("SELECT DISTINCT ct.teamName FROM CompetitionTeam ct ORDER BY ct.teamName ASC")
    List<String> findAllDistinctTeamNames();
}
