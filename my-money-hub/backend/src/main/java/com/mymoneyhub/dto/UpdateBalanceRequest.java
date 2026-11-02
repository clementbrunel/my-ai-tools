package com.mymoneyhub.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;

/** @param date day the balance was observed; null means now. */
public record UpdateBalanceRequest(
        @NotNull @Digits(integer = 12, fraction = 2) BigDecimal balance,
        @PastOrPresent LocalDate date
) {
}
