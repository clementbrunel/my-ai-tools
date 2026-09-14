package com.mymoneyhub.repository;

import com.mymoneyhub.entity.BalanceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface BalanceSnapshotRepository extends JpaRepository<BalanceSnapshot, Long> {

    List<BalanceSnapshot> findByAccountIdAndRecordedAtAfterOrderByRecordedAtAsc(Long accountId, LocalDateTime after);
}
