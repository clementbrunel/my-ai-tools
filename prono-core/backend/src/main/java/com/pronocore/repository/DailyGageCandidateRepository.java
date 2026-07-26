package com.pronocore.repository;

import com.pronocore.entity.DailyGageCandidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DailyGageCandidateRepository extends JpaRepository<DailyGageCandidate, Long> {

    Optional<DailyGageCandidate> findByDailyGageIdAndForfeitId(Long dailyGageId, Long forfeitId);
}
