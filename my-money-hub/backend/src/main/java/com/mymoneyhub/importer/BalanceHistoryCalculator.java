package com.mymoneyhub.importer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/** Rebuilds a month-end balance history from the operations alone (the Linxo export carries no balance). */
public final class BalanceHistoryCalculator {

    private BalanceHistoryCalculator() {
    }

    public record Operation(LocalDate date, BigDecimal amount) {
    }

    public record Point(LocalDate date, BigDecimal balance) {
    }

    /**
     * @param operations sorted by date ascending
     * @param anchor     balance known after every operation (the account's current balance), or {@code null}
     *                   when unknown — balances are then cumulated from 0 (relative to the start of the history)
     * @param before     only month ends strictly before this date are emitted (later points belong to the sync)
     */
    public static List<Point> monthEnds(List<Operation> operations, BigDecimal anchor, LocalDate before) {
        List<Point> points = new ArrayList<>();
        if (operations.isEmpty()) {
            return points;
        }
        BigDecimal total = operations.stream().map(Operation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cumulative = BigDecimal.ZERO;
        int next = 0;
        for (YearMonth month = YearMonth.from(operations.get(0).date()); ; month = month.plusMonths(1)) {
            LocalDate end = month.atEndOfMonth();
            if (!end.isBefore(before)) {
                break;
            }
            while (next < operations.size() && !operations.get(next).date().isAfter(end)) {
                cumulative = cumulative.add(operations.get(next++).amount());
            }
            points.add(new Point(end, anchor == null ? cumulative : anchor.subtract(total.subtract(cumulative))));
        }
        return points;
    }
}
