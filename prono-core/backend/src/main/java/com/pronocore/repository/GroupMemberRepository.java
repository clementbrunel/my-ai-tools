package com.pronocore.repository;

import com.pronocore.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.user WHERE gm.group.id = :groupId")
    List<GroupMember> findByGroupId(@Param("groupId") Long groupId);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.group WHERE gm.user.id = :userId")
    List<GroupMember> findByUserId(@Param("userId") Long userId);

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.user WHERE gm.group.id = :groupId AND gm.status = :status")
    List<GroupMember> findByGroupIdAndStatus(@Param("groupId") Long groupId, @Param("status") GroupMember.MemberStatus status);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.group WHERE gm.user.id = :userId AND gm.status = :status")
    List<GroupMember> findByUserIdAndStatus(@Param("userId") Long userId, @Param("status") GroupMember.MemberStatus status);

    long countByGroupIdAndStatus(Long groupId, GroupMember.MemberStatus status);

    /** Returns [groupId, count] for pending applications across multiple groups (single batch query). */
    @Query("SELECT gm.group.id, COUNT(gm) FROM GroupMember gm WHERE gm.group.id IN :groupIds AND gm.status = com.pronocore.entity.GroupMember.MemberStatus.PENDING GROUP BY gm.group.id")
    List<Object[]> countPendingByGroupIds(@Param("groupIds") List<Long> groupIds);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.group WHERE gm.group.id IN :groupIds")
    List<GroupMember> findByGroupIdIn(@Param("groupIds") List<Long> groupIds);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.group JOIN FETCH gm.user")
    List<GroupMember> findAllWithGroupAndUser();
}
