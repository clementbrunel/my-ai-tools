package com.pronocore.util;

import com.pronocore.dto.response.MatchOutcome;
import com.pronocore.dto.response.TeamSummaryResponse;
import com.pronocore.entity.Match;

import java.util.List;
import java.util.Optional;

/** Win/draw/loss outcome of finished matches from a team's point of view. */
public final class TeamForm {

    /** Number of recent outcomes shown as form badges. */
    public static final int RECENT_COUNT = 5;

    /** Below this many finished matches the form is too thin to be meaningful. */
    public static final int MIN_MATCHES = 3;

    private TeamForm() {}

    /** Empty when the match has no score yet. Penalty shoot-outs don't count: a draw stays a draw. */
    public static Optional<MatchOutcome> outcome(Match match, Long teamId) {
        if (match.getScoreA() == null || match.getScoreB() == null) {
            return Optional.empty();
        }
        boolean isTeamA = match.getTeamA().getId().equals(teamId);
        int mine = isTeamA ? match.getScoreA() : match.getScoreB();
        int theirs = isTeamA ? match.getScoreB() : match.getScoreA();
        return Optional.of(mine > theirs ? MatchOutcome.W : mine < theirs ? MatchOutcome.L : MatchOutcome.D);
    }

    /** Totals and recent outcomes of the team over its finished matches, given newest first. */
    public static TeamSummaryResponse summarize(List<Match> finishedNewestFirst, Long teamId) {
        List<MatchOutcome> outcomes = finishedNewestFirst.stream()
                .map(m -> outcome(m, teamId)).flatMap(Optional::stream).toList();
        List<MatchOutcome> recent = outcomes.size() < MIN_MATCHES
                ? List.of()
                : outcomes.stream().limit(RECENT_COUNT).toList();
        return new TeamSummaryResponse(
                (int) outcomes.stream().filter(o -> o == MatchOutcome.W).count(),
                (int) outcomes.stream().filter(o -> o == MatchOutcome.D).count(),
                (int) outcomes.stream().filter(o -> o == MatchOutcome.L).count(),
                recent, null);
    }
}
