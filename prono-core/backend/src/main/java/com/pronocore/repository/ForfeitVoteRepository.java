package com.pronocore.repository;

import com.pronocore.entity.ForfeitVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ForfeitVoteRepository extends JpaRepository<ForfeitVote, Long> {

    Optional<ForfeitVote> findByForfeitIdAndUserId(Long forfeitId, Long userId);

    void deleteByForfeitIdAndUserId(Long forfeitId, Long userId);

    @Modifying
    @Query(value = "INSERT INTO forfeit_votes (forfeit_id, user_id, vote) VALUES (:forfeitId, :userId, :vote) " +
                   "ON CONFLICT ON CONSTRAINT uq_forfeit_vote DO UPDATE SET vote = EXCLUDED.vote",
           nativeQuery = true)
    void upsertVote(@Param("forfeitId") Long forfeitId, @Param("userId") Long userId, @Param("vote") int vote);

    List<ForfeitVote> findByForfeitIdInAndUserId(List<Long> forfeitIds, Long userId);

    /** Returns [forfeitId, totalScore] rows for the given forfeit IDs. */
    @Query("SELECT fv.forfeit.id, COALESCE(SUM(fv.vote), 0) FROM ForfeitVote fv WHERE fv.forfeit.id IN :ids GROUP BY fv.forfeit.id")
    List<Object[]> sumVoteScoresByForfeitIds(@Param("ids") List<Long> ids);
}
