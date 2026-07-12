package com.pronocore.repository;

import com.pronocore.entity.Bet;
import com.pronocore.entity.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Repository
public interface BetRepository extends JpaRepository<Bet, Long> {

    List<Bet> findByMatchIdOrderByCreatedAtDesc(Long matchId);

    List<Bet> findByMatchIdAndStatusOrderByCreatedAtDesc(Long matchId, Bet.Status status);

    boolean existsByMatchIdAndGroupId(Long matchId, Long groupId);

    boolean existsByGroupIdAndStatus(Long groupId, Bet.Status status);

    List<Bet> findByMatchIdAndGroupId(Long matchId, Long groupId);

    /** Bets belonging to any group the user is an ACTIVE member of. */
    @Query("""
            SELECT DISTINCT b FROM Bet b
            JOIN FETCH b.group g
            JOIN FETCH b.creator
            LEFT JOIN FETCH b.match
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY b.createdAt DESC
            """)
    List<Bet> findAllInUserActiveGroups(@Param("userId") Long userId);

    /** Bets for a given match, restricted to the user's ACTIVE groups. */
    @Query("""
            SELECT DISTINCT b FROM Bet b
            JOIN FETCH b.group g
            JOIN FETCH b.creator
            LEFT JOIN FETCH b.match
            JOIN GroupMember gm ON gm.group = b.group
            WHERE b.match.id = :matchId
              AND gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY b.createdAt DESC
            """)
    List<Bet> findByMatchIdInUserActiveGroups(@Param("matchId") Long matchId, @Param("userId") Long userId);

    List<Bet> findByStatusOrderByCreatedAtDesc(Bet.Status status);

    // ---------------------------------------------------------------
    // F1 races (mirror of the match-scoped queries)
    // ---------------------------------------------------------------

    boolean existsByRaceIdAndGroupId(Long raceId, Long groupId);

    boolean existsByRaceId(Long raceId);

    List<Bet> findByRaceIdAndGroupId(Long raceId, Long groupId);

    List<Bet> findByRaceIdAndStatusOrderByCreatedAtDesc(Long raceId, Bet.Status status);

    /** Bets for a given race, restricted to the user's ACTIVE groups. */
    @Query("""
            SELECT DISTINCT b FROM Bet b
            JOIN FETCH b.group g
            JOIN FETCH b.creator
            JOIN GroupMember gm ON gm.group = b.group
            WHERE b.race.id = :raceId
              AND gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY b.createdAt DESC
            """)
    List<Bet> findByRaceIdInUserActiveGroups(@Param("raceId") Long raceId, @Param("userId") Long userId);

    /** Race ids that have at least one bet (any status) in the user's active groups. */
    @Query("""
            SELECT DISTINCT b.race.id FROM Bet b
            JOIN GroupMember gm ON gm.group = b.group
            WHERE b.race IS NOT NULL
              AND gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            """)
    Set<Long> findRaceIdsWithBetsInUserGroups(@Param("userId") Long userId);

    List<Bet> findAllByOrderByCreatedAtDesc();

    @Query("SELECT b FROM Bet b WHERE b.creator.id = :creatorId ORDER BY b.createdAt DESC")
    List<Bet> findByCreatorId(@Param("creatorId") Long creatorId);

    @Query("SELECT COUNT(bp) FROM BetParticipation bp WHERE bp.bet.id = :betId")
    long countParticipationsByBetId(@Param("betId") Long betId);

    /** Returns [betId, count] for multiple bets in a single query. */
    @Query("SELECT bp.bet.id, COUNT(bp) FROM BetParticipation bp WHERE bp.bet.id IN :betIds GROUP BY bp.bet.id")
    List<Object[]> countParticipationsByBetIds(@Param("betIds") List<Long> betIds);

    /** Distinct matches that have at least one bet (any status) in the user's active groups. */
    @Query("""
            SELECT DISTINCT m FROM Bet b
            JOIN b.match m
            JOIN FETCH m.teamA
            JOIN FETCH m.teamB
            JOIN FETCH m.competition
            JOIN GroupMember gm ON gm.group = b.group
            WHERE gm.user.id = :userId
              AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            ORDER BY m.matchDate ASC
            """)
    List<Match> findDistinctMatchesWithBetsInUserGroups(@Param("userId") Long userId);

    /** Group IDs that have at least one OPEN bet, restricted to the given group IDs. */
    @Query("SELECT DISTINCT b.group.id FROM Bet b WHERE b.group.id IN :groupIds AND b.status = com.pronocore.entity.Bet.Status.OPEN")
    Set<Long> findGroupIdsWithOpenBets(@Param("groupIds") List<Long> groupIds);

    /** Returns true if at least one OPEN bet exists for the given group on the given calendar day (match kick-off or race start). */
    @Query("""
            SELECT COUNT(b) > 0 FROM Bet b
            LEFT JOIN b.match m
            LEFT JOIN b.race r
            WHERE b.group.id = :groupId
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND ((m.matchDate >= :startOfDay AND m.matchDate < :endOfDay)
                OR (r.raceDate  >= :startOfDay AND r.raceDate  < :endOfDay))
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

    /** Distinct matches with at least one OPEN bet for a group, ordered by date. */
    @Query("""
            SELECT DISTINCT b.match FROM Bet b
            WHERE b.group.id = :groupId
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND b.match IS NOT NULL
            ORDER BY b.match.matchDate ASC
            """)
    List<Match> findDistinctMatchesWithOpenBetsForGroup(@Param("groupId") Long groupId);

    /** Distinct future matches (kick-off after now) with at least one OPEN bet for a group, ordered by date. */
    @Query("""
            SELECT DISTINCT b.match FROM Bet b
            WHERE b.group.id = :groupId
              AND b.status = com.pronocore.entity.Bet.Status.OPEN
              AND b.match IS NOT NULL
              AND b.match.matchDate > :now
            ORDER BY b.match.matchDate ASC
            """)
    List<Match> findFutureDistinctMatchesWithOpenBetsForGroup(@Param("groupId") Long groupId, @Param("now") LocalDateTime now);

    /** Count of UPCOMING matches that have no bet (any status) in the given group. */
    @Query("""
            SELECT COUNT(m) FROM Match m
            WHERE m.status = com.pronocore.entity.Match.Status.UPCOMING
              AND NOT EXISTS (
                SELECT 1 FROM Bet b WHERE b.match = m AND b.group.id = :groupId
              )
            """)
    long countUpcomingMatchesWithoutBetsForGroup(@Param("groupId") Long groupId);
}
