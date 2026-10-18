package com.pronocore.dto.response;

import java.util.List;

/**
 * A team's win/draw/loss totals and most recent outcomes (newest first) over a set of finished
 * matches — all competitions on the team page, one competition before the match on the match page.
 * {@code recent} is empty when the history is too thin to be meaningful. {@code ranking} is the
 * team's current league position, set only on the match page (null otherwise).
 */
public record TeamSummaryResponse(int won, int draw, int lost, List<MatchOutcome> recent, TeamRanking ranking) {

    public TeamSummaryResponse withRanking(TeamRanking ranking) {
        return new TeamSummaryResponse(won, draw, lost, recent, ranking);
    }
}
