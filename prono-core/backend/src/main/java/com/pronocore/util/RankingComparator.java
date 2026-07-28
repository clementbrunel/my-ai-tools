package com.pronocore.util;

import java.util.Comparator;
import java.util.Map;

/**
 * The single ranking criterion shared by the leaderboard and the dashboard's
 * per-group rank: total points descending, ties broken by bets won descending.
 * Kept in one place so the two pages can never silently disagree.
 */
public final class RankingComparator {

    private RankingComparator() {
    }

    public static Comparator<Long> byPointsThenBetsWonDesc(Map<Long, Integer> pointsByUserId,
                                                             Map<Long, Integer> betsWonByUserId) {
        return Comparator
                .comparingInt((Long userId) -> -pointsByUserId.getOrDefault(userId, 0))
                .thenComparingInt(userId -> -betsWonByUserId.getOrDefault(userId, 0));
    }
}
