package com.mymoneyhub.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Result (or dry-run preview) of a Linxo import. Counts of {@code imported} are what would be inserted when dryRun. */
public record LinxoImportReport(
        boolean dryRun,
        int rowsRead,
        int rowsRejected,
        List<String> errors,
        LocalDate from,
        LocalDate to,
        int imported,
        int skippedDuplicate,
        int skippedOverlap,
        List<AccountReport> accounts
) {

    public record AccountReport(
            String connection,
            String account,
            int rows,
            LocalDate from,
            LocalDate to,
            BigDecimal total,
            LinxoAccountChoice.Action action,
            Long accountId,
            String accountLabel,
            int imported,
            int skippedDuplicate,
            int skippedOverlap,
            LocalDate syncStartsOn,
            int balanceSnapshots
    ) {
    }
}
