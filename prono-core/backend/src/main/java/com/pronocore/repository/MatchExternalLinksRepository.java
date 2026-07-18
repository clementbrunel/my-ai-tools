package com.pronocore.repository;

import com.pronocore.entity.MatchExternalLinks;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MatchExternalLinksRepository extends JpaRepository<MatchExternalLinks, Long> {
}
