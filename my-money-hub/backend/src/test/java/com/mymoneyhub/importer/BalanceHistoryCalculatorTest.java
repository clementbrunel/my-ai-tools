package com.mymoneyhub.importer;

import com.mymoneyhub.importer.BalanceHistoryCalculator.Operation;
import com.mymoneyhub.importer.BalanceHistoryCalculator.Point;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BalanceHistoryCalculatorTest {

    private static final List<Operation> OPERATIONS = List.of(
            new Operation(LocalDate.of(2020, 1, 10), new BigDecimal("100.00")),
            new Operation(LocalDate.of(2020, 1, 20), new BigDecimal("-30.00")),
            new Operation(LocalDate.of(2020, 3, 5), new BigDecimal("-20.00")));

    @Test
    void cumulatesFromZeroWithoutAnchor() {
        List<Point> points = BalanceHistoryCalculator.monthEnds(OPERATIONS, null, LocalDate.of(2020, 4, 15));

        assertThat(points).extracting(Point::date)
                .containsExactly(LocalDate.of(2020, 1, 31), LocalDate.of(2020, 2, 29), LocalDate.of(2020, 3, 31));
        assertThat(points).extracting(Point::balance)
                .usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .containsExactly(new BigDecimal("70"), new BigDecimal("70"), new BigDecimal("50"));
    }

    @Test
    void walksBackFromAnchor() {
        // 150 after all operations (total +50) => balance before the first operation was 100
        List<Point> points = BalanceHistoryCalculator.monthEnds(OPERATIONS, new BigDecimal("150"), LocalDate.of(2020, 4, 15));

        assertThat(points).extracting(Point::balance)
                .usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .containsExactly(new BigDecimal("170"), new BigDecimal("170"), new BigDecimal("150"));
    }

    @Test
    void stopsBeforeTheGivenDate() {
        List<Point> points = BalanceHistoryCalculator.monthEnds(OPERATIONS, null, LocalDate.of(2020, 2, 29));

        assertThat(points).extracting(Point::date).containsExactly(LocalDate.of(2020, 1, 31));
    }
}
