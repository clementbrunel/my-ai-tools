package com.mymoneyhub.connector;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FetchedTransaction(
        String externalId,
        LocalDate bookingDate,
        BigDecimal amount,
        String currency,
        String description
) {
}
