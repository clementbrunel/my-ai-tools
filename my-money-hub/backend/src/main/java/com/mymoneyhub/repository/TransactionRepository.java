package com.mymoneyhub.repository;

import com.mymoneyhub.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByAccountIdOrderByBookingDateDesc(Long accountId);

    Optional<Transaction> findByAccountIdAndExternalId(Long accountId, String externalId);
}
