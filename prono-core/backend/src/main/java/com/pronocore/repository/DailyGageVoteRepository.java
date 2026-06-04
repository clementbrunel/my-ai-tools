package com.pronocore.repository;

import com.pronocore.entity.DailyGageVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DailyGageVoteRepository extends JpaRepository<DailyGageVote, Long> {

    Optional<DailyGageVote> findByCandidateIdAndUserId(Long candidateId, Long userId);

    void deleteByCandidateIdAndUserId(Long candidateId, Long userId);
}
