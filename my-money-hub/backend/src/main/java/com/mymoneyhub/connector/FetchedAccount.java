package com.mymoneyhub.connector;

import com.mymoneyhub.entity.Account;

import java.math.BigDecimal;

/** Account data as returned by a connector, before it's matched against an existing
 *  {@link Account} row (by {@code externalAccountId}) or inserted as a new one. */
public record FetchedAccount(
        String externalAccountId,
        String label,
        String iban,
        String currency,
        Account.AccountType type,
        BigDecimal currentBalance
) {
}
