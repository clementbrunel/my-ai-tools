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

    /** Used by fixture import to skip api-football fixtures already linked to a match, in one batched call. */
    @Query("SELECT l.apiFootballFixtureId FROM MatchExternalLinks l WHERE l.apiFootballFixtureId IN :fixtureIds")
    List<Long> findApiFootballFixtureIdsIn(@Param("fixtureIds") Collection<Long> fixtureIds);
}
