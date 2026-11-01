package com.mymoneyhub.repository;

import com.mymoneyhub.entity.BalanceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import com.mymoneyhub.entity.DataSource;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BalanceSnapshotRepository extends JpaRepository<BalanceSnapshot, Long> {

    List<BalanceSnapshot> findByAccountIdAndRecordedAtAfterOrderByRecordedAtAsc(Long accountId, LocalDateTime after);

    @Query("select min(b.recordedAt) from BalanceSnapshot b where b.account.id = :accountId and b.source = :source")
    LocalDateTime findEarliestRecordedAt(@Param("accountId") Long accountId, @Param("source") DataSource source);

    @Modifying
    @Query("delete from BalanceSnapshot b where b.account.id = :accountId and b.source = :source")
    void deleteByAccountIdAndSource(@Param("accountId") Long accountId, @Param("source") DataSource source);
}
