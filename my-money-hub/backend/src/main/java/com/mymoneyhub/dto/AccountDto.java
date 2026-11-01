package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Account;
import com.mymoneyhub.entity.Institution;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountDto(
        Long id,
        String institutionName,
        String label,
        String iban,
        String currency,
        Account.AccountType type,
        Institution.ConnectorType connectorType,
        BigDecimal currentBalance,
        LocalDateTime lastSyncedAt,
        boolean archived
) {
}
