package com.pronocore.repository;

import com.pronocore.entity.Bet;
import com.pronocore.entity.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {

    List<Bet> findByMatchIdOrderByCreatedAtDesc(Long matchId);

    List<Bet> findByMatchIdAndStatusOrderByCreatedAtDesc(Long matchId, Bet.Status status);

    List<Bet> findByStatusOrderByCreatedAtDesc(Bet.Status status);

    List<Bet> findAllByOrderByCreatedAtDesc();

    @Query("SELECT b FROM Bet b WHERE b.creator.id = :creatorId ORDER BY b.createdAt DESC")
    List<Bet> findByCreatorId(@Param("creatorId") Long creatorId);

    @Query("SELECT bp.bet FROM BetParticipation bp WHERE bp.user.id = :userId ORDER BY bp.createdAt DESC")
    List<Bet> findParticipatedBetsByUserId(@Param("userId") Long userId);

    @Query("SELECT COUNT(bp) FROM BetParticipation bp WHERE bp.bet.id = :betId")
    long countParticipationsByBetId(@Param("betId") Long betId);

    @Query("SELECT COUNT(DISTINCT b.match.id) FROM Bet b " +
           "JOIN GroupMember gm ON gm.group = b.group " +
           "WHERE gm.user.id = :userId " +
           "AND b.status = :betStatus " +
           "AND b.match.status = :matchStatus")
    long countDistinctUpcomingMatchesInUserGroups(
            @Param("userId") Long userId,
            @Param("betStatus") Bet.Status betStatus,
            @Param("matchStatus") Match.Status matchStatus);
}
