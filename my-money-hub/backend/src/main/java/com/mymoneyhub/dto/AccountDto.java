package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Account;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountDto(
        Long id,
        String institutionName,
        String label,
        String iban,
        String currency,
        Account.AccountType type,
        BigDecimal currentBalance,
        LocalDateTime lastSyncedAt
) {
}
