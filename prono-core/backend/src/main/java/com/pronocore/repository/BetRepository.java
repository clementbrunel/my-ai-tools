package com.pronocore.repository;

import com.pronocore.entity.Bet;
import com.pronocore.entity.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {

    List<Bet> findByMatchIdOrderByCreatedAtDesc(Long matchId);

    List<Bet> findByMatchIdAndStatusOrderByCreatedAtDesc(Long matchId, Bet.Status status);

    boolean existsByMatchIdAndGroupId(Long matchId, Long groupId);

    boolean existsByGroupIdAndStatus(Long groupId, Bet.Status status);

    List<Bet> findByMatchIdAndGroupId(Long matchId, Long groupId);

    /** Bets belonging to any group the user is an ACTIVE member of. */
    @Query("""
            SELECT b FROM Bet b
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY b.createdAt DESC
            """)
    List<Bet> findAllInUserActiveGroups(@Param("userId") Long userId);

    /** Bets for a given match, restricted to the user's ACTIVE groups. */
    @Query("""
            SELECT b FROM Bet b
            JOIN GroupMember gm ON gm.group = b.group
            WHERE b.match.id = :matchId
              AND gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY b.createdAt DESC
            """)
    List<Bet> findByMatchIdInUserActiveGroups(@Param("matchId") Long matchId, @Param("userId") Long userId);

    List<Bet> findByStatusOrderByCreatedAtDesc(Bet.Status status);

    List<Bet> findAllByOrderByCreatedAtDesc();

    @Query("SELECT b FROM Bet b WHERE b.creator.id = :creatorId ORDER BY b.createdAt DESC")
    List<Bet> findByCreatorId(@Param("creatorId") Long creatorId);

    @Query("SELECT bp.bet FROM BetParticipation bp WHERE bp.user.id = :userId ORDER BY bp.createdAt DESC")
    List<Bet> findParticipatedBetsByUserId(@Param("userId") Long userId);

    @Query("SELECT COUNT(bp) FROM BetParticipation bp WHERE bp.bet.id = :betId")
    long countParticipationsByBetId(@Param("betId") Long betId);

    /** Distinct matches that have at least one bet (any status) in the user's active groups. */
    @Query("""
            SELECT DISTINCT b.match FROM Bet b
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
              AND b.match IS NOT NULL
            ORDER BY b.match.matchDate ASC
            """)
    List<Match> findDistinctMatchesWithBetsInUserGroups(@Param("userId") Long userId);

    /** Returns true if at least one OPEN bet exists for the given group on the given calendar day. */
    @Query("""
            SELECT COUNT(b) > 0 FROM Bet b
            WHERE b.group.id = :groupId
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND b.match IS NOT NULL
              AND b.match.matchDate >= :startOfDay
              AND b.match.matchDate < :endOfDay
            """)
    boolean existsOpenBetForGroupOnDay(@Param("groupId") Long groupId,
                                       @Param("startOfDay") LocalDateTime startOfDay,
                                       @Param("endOfDay") LocalDateTime endOfDay);

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
