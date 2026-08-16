package com.pronocore.repository;

import com.pronocore.entity.MatchExternalLinks;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface MatchExternalLinksRepository extends JpaRepository<MatchExternalLinks, Long> {

    /**
     * Used by fixture import to tell new fixtures from already-linked ones, and to
     * reconcile the linked match's date/matchday when football-data.org reports a
     * reschedule (broadcast time changes are common mid-season) — one batched call.
     */
    @Query("SELECT l FROM MatchExternalLinks l JOIN FETCH l.match WHERE l.footballDataMatchId IN :matchIds")
    List<MatchExternalLinks> findByFootballDataMatchIdIn(@Param("matchIds") Collection<Long> matchIds);
}
