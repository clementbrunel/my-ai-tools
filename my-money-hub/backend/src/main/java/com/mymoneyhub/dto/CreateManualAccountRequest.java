package com.mymoneyhub.dto;

import com.mymoneyhub.entity.Account;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** @param currency ISO code, defaults to EUR.
 *  @param date day the initial balance was observed; null means now. */
public record CreateManualAccountRequest(
        @NotBlank @Size(max = 150) String label,
        @NotNull Account.AccountType type,
        @Pattern(regexp = "[A-Z]{3}") String currency,
        @NotNull @Digits(integer = 12, fraction = 2) BigDecimal initialBalance,
        @PastOrPresent LocalDate date
) {
}
