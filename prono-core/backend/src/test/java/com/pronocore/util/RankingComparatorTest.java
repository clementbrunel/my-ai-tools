package com.pronocore.util;

import org.junit.jupiter.api.Test;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RankingComparatorTest {

    @Test
    void ordersByPointsDescending() {
        Map<Long, Integer> points = Map.of(1L, 10, 2L, 30, 3L, 20);
        Map<Long, Integer> betsWon = Map.of();

        List<Long> sorted = List.of(1L, 2L, 3L).stream()
                .sorted(RankingComparator.byPointsThenBetsWonDesc(points, betsWon))
                .toList();

        assertThat(sorted).containsExactly(2L, 3L, 1L);
    }

    @Test
    void breaksTiesByBetsWonDescending() {
        Map<Long, Integer> points = Map.of(1L, 10, 2L, 10, 3L, 10);
        Map<Long, Integer> betsWon = Map.of(1L, 1, 2L, 5, 3L, 3);

        List<Long> sorted = List.of(1L, 2L, 3L).stream()
                .sorted(RankingComparator.byPointsThenBetsWonDesc(points, betsWon))
                .toList();

        assertThat(sorted).containsExactly(2L, 3L, 1L);
    }

    @Test
    void treatsMissingEntriesAsZero() {
        Map<Long, Integer> points = Map.of(1L, 5);
        Map<Long, Integer> betsWon = Map.of();

        List<Long> sorted = List.of(1L, 2L).stream()
                .sorted(RankingComparator.byPointsThenBetsWonDesc(points, betsWon))
                .toList();

        assertThat(sorted).containsExactly(1L, 2L);
    }

    @Test
    void isUsableAsAComparatorOnAnEntityKeyedById() {
        record Member(Long id) {
        }
        Map<Long, Integer> points = Map.of(1L, 1, 2L, 2);
        Map<Long, Integer> betsWon = Map.of();

        Comparator<Member> comparator = Comparator.comparing(Member::id,
                RankingComparator.byPointsThenBetsWonDesc(points, betsWon));

        List<Member> sorted = List.of(new Member(1L), new Member(2L)).stream()
                .sorted(comparator)
                .toList();

        assertThat(sorted).extracting(Member::id).containsExactly(2L, 1L);
    }
}
