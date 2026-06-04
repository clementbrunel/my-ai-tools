package com.pronocore.repository;

import com.pronocore.entity.GroupForfeit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupForfeitRepository extends JpaRepository<GroupForfeit, Long> {

    List<GroupForfeit> findByGroupId(Long groupId);

    List<GroupForfeit> findByGroupIdAndIsActive(Long groupId, boolean isActive);
}
