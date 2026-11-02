package com.mymoneyhub.repository;

import com.mymoneyhub.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import com.mymoneyhub.entity.DataSource;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByAccountIdOrderByBookingDateDesc(Long accountId);

    Optional<Transaction> findByAccountIdAndExternalId(Long accountId, String externalId);

    /** Oldest booking date written by a connector sync — the Linxo import yields to the sync from this date on. */
    @Query("select min(t.bookingDate) from Transaction t where t.account.id = :accountId and t.source = :source")
    LocalDate findFirstBookingDate(@Param("accountId") Long accountId, @Param("source") DataSource source);

    @Query("select t.externalId from Transaction t where t.account.id = :accountId and t.source = :source and t.externalId is not null")
    Set<String> findExternalIds(@Param("accountId") Long accountId, @Param("source") DataSource source);
}
