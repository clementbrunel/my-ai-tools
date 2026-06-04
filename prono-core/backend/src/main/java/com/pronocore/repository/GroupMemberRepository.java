package com.pronocore.repository;

import com.pronocore.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    List<GroupMember> findByGroupId(Long groupId);

    List<GroupMember> findByUserId(Long userId);

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    List<GroupMember> findByGroupIdAndStatus(Long groupId, GroupMember.MemberStatus status);

    List<GroupMember> findByUserIdAndStatus(Long userId, GroupMember.MemberStatus status);

    long countByGroupIdAndStatus(Long groupId, GroupMember.MemberStatus status);
}
