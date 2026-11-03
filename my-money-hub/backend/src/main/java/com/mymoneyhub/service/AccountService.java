package com.mymoneyhub.service;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.CreateManualAccountRequest;
import com.mymoneyhub.dto.NetWorthDto;
import com.mymoneyhub.dto.UpdateBalanceRequest;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.BalanceSnapshot;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.AccountRepository;
import com.mymoneyhub.repository.BalanceSnapshotRepository;
import com.mymoneyhub.repository.InstitutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final InstitutionRepository institutionRepository;
    private final BalanceSnapshotRepository balanceSnapshotRepository;

    @Transactional(readOnly = true)
    public List<AccountDto> listAll() {
        return accountRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public NetWorthDto netWorth() {
        List<Account> accounts = accountRepository.findAll();
        BigDecimal total = accounts.stream()
                .filter(account -> !account.isArchived())
                .map(Account::getCurrentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new NetWorthDto(total, accounts.stream().map(this::toDto).toList());
    }

    /** Creates an account under a MANUAL institution (the ManualConnector never discovers any) and records its first balance. */
    @Transactional
    public AccountDto createManualAccount(Long institutionId, CreateManualAccountRequest request) {
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Institution not found"));
        requireManual(institution);

        Account account = accountRepository.save(Account.builder()
                .institution(institution)
                .label(request.label().trim())
                .type(request.type())
                .currency(request.currency() != null ? request.currency() : "EUR")
                .build());
        return toDto(recordBalance(account, request.initialBalance(), request.date()));
    }

    /** Manual balance entry: updates the current balance and appends a history point. A backdated entry that is
     *  older than the latest snapshot only lands in the history and leaves the current balance untouched. */
    @Transactional
    public AccountDto updateManualBalance(Long accountId, UpdateBalanceRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        requireManual(account.getInstitution());
        return toDto(recordBalance(account, request.balance(), request.date()));
    }

    private Account recordBalance(Account account, BigDecimal balance, LocalDate date) {
        LocalDateTime recordedAt = date == null || date.equals(LocalDate.now())
                ? LocalDateTime.now()
                : date.atStartOfDay();

        if (!balanceSnapshotRepository.existsByAccountIdAndRecordedAtAfter(account.getId(), recordedAt)) {
            account.setCurrentBalance(balance);
            account.setLastSyncedAt(recordedAt);
            account = accountRepository.save(account);
        }
        balanceSnapshotRepository.save(BalanceSnapshot.builder()
                .account(account)
                .balance(balance)
                .recordedAt(recordedAt)
                .build());
        return account;
    }

    private void requireManual(Institution institution) {
        if (institution.getConnectorType() != Institution.ConnectorType.MANUAL) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Balance of " + institution.getName() + " is synced automatically — manual entry not allowed");
        }
    }

    AccountDto toDto(Account account) {
        return new AccountDto(
                account.getId(),
                account.getInstitution().getName(),
                account.getLabel(),
                account.getIban(),
                account.getCurrency(),
                account.getType(),
                account.getInstitution().getConnectorType(),
                account.getCurrentBalance(),
                account.getLastSyncedAt(),
                account.isArchived()
        );
    }
}
