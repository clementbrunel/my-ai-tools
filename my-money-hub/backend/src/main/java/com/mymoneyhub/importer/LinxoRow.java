package com.mymoneyhub.importer;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One operation of a Linxo CSV export. {@code line} is the record number in the file, for error reporting. */
public record LinxoRow(
        int line,
        LocalDate date,
        String label,
        String category,
        BigDecimal amount,
        String notes,
        String account,
        String connection
) {
}
