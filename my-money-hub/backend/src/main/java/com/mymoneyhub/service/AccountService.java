package com.mymoneyhub.service;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.NetWorthDto;
import com.mymoneyhub.entity.Account;
import com.mymoneyhub.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;

    public List<AccountDto> listAll() {
        return accountRepository.findAll().stream().map(this::toDto).toList();
    }

    public NetWorthDto netWorth() {
        List<Account> accounts = accountRepository.findAll();
        BigDecimal total = accounts.stream()
                .map(Account::getCurrentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new NetWorthDto(total, accounts.stream().map(this::toDto).toList());
    }

    private AccountDto toDto(Account account) {
        return new AccountDto(
                account.getId(),
                account.getInstitution().getName(),
                account.getLabel(),
                account.getIban(),
                account.getCurrency(),
                account.getType(),
                account.getCurrentBalance(),
                account.getLastSyncedAt()
        );
    }
}
