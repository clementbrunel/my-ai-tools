package com.mymoneyhub.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Total balance of all active accounts at the end of {@code date}. */
public record NetWorthPointDto(LocalDate date, BigDecimal total) {
}
