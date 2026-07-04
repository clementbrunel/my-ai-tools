package com.pronocore.repository;

import com.pronocore.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {

    @Query("SELECT g FROM Group g JOIN FETCH g.createdBy WHERE g.inviteCode = :code")
    Optional<Group> findByInviteCode(@Param("code") String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    @Query("SELECT g FROM Group g JOIN FETCH g.createdBy WHERE g.isPrivate = false")
    List<Group> findByIsPrivateFalse();

    @Query("SELECT g FROM Group g JOIN FETCH g.createdBy")
    List<Group> findAllWithCreatedBy();

    /** Member counts per public group in a single query: [groupId, activeCount]. */
    @Query("""
            SELECT gm.group.id, COUNT(gm)
            FROM GroupMember gm
            WHERE gm.group.isPrivate = false AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.ACTIVE
            GROUP BY gm.group.id
            """)
    List<Object[]> countActiveMembersForPublicGroups();
}
