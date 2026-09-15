package com.mymoneyhub.repository;

import com.mymoneyhub.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountRepository extends JpaRepository<Account, Long> {

    List<Account> findByInstitutionId(Long institutionId);

    List<Account> findByExternalAccountIdAndInstitutionId(String externalAccountId, Long institutionId);
}
