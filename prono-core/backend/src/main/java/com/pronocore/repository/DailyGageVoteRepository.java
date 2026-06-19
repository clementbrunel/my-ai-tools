package com.pronocore.repository;

import com.pronocore.entity.DailyGageVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DailyGageVoteRepository extends JpaRepository<DailyGageVote, Long> {

    Optional<DailyGageVote> findByCandidateIdAndUserId(Long candidateId, Long userId);

    void deleteByCandidateIdAndUserId(Long candidateId, Long userId);

    /** All votes for the given candidates (used to avoid N+1 when building gage response). */
    @Query("SELECT v FROM DailyGageVote v JOIN FETCH v.user JOIN FETCH v.candidate WHERE v.candidate.id IN :candidateIds")
    List<DailyGageVote> findByCandidateIdIn(@Param("candidateIds") List<Long> candidateIds);
}
