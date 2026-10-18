package com.pronocore.util;

import com.pronocore.dto.response.MatchOutcome;
import com.pronocore.dto.response.TeamSummaryResponse;
import com.pronocore.entity.Match;
import com.pronocore.entity.Team;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TeamFormTest {

    private static final Team PSG = Team.builder().id(1L).name("PSG").build();
    private static final Team OM = Team.builder().id(2L).name("OM").build();

    /** Finished match PSG vs OM (PSG at home when {@code psgHome}). */
    private static Match match(boolean psgHome, int scoreA, int scoreB) {
        return Match.builder()
                .teamA(psgHome ? PSG : OM).teamB(psgHome ? OM : PSG)
                .scoreA(scoreA).scoreB(scoreB)
                .status(Match.Status.FINISHED)
                .build();
    }

    @Test
    void summarize_countsOutcomesFromTeamPerspective_andKeepsRecentNewestFirst() {
        // newest first: win (away), draw, loss (home), win (home)
        TeamSummaryResponse summary = TeamForm.summarize(List.of(
                match(false, 0, 2), match(true, 1, 1), match(true, 0, 1), match(true, 3, 0)), 1L);

        assertThat(summary.won()).isEqualTo(2);
        assertThat(summary.draw()).isEqualTo(1);
        assertThat(summary.lost()).isEqualTo(1);
        assertThat(summary.recent()).containsExactly(MatchOutcome.W, MatchOutcome.D, MatchOutcome.L, MatchOutcome.W);
        assertThat(summary.ranking()).isNull();
    }

    @Test
    void summarize_recentIsCappedAtFive_totalsCountEverything() {
        TeamSummaryResponse summary = TeamForm.summarize(List.of(
                match(true, 1, 0), match(true, 1, 0), match(true, 1, 0),
                match(true, 1, 0), match(true, 1, 0), match(true, 0, 1)), 1L);

        assertThat(summary.won()).isEqualTo(5);
        assertThat(summary.lost()).isEqualTo(1);
        assertThat(summary.recent()).hasSize(5).containsOnly(MatchOutcome.W);
    }

    @Test
    void summarize_underMinimumMatches_hasTotalsButNoRecent() {
        TeamSummaryResponse summary = TeamForm.summarize(List.of(match(true, 1, 0), match(true, 2, 2)), 1L);

        assertThat(summary.won()).isEqualTo(1);
        assertThat(summary.draw()).isEqualTo(1);
        assertThat(summary.recent()).isEmpty();
    }

    @Test
    void summarize_penaltyShootoutStaysADraw() {
        Match shootout = match(true, 1, 1);
        shootout.setPenaltyWinner("A");

        assertThat(TeamForm.summarize(List.of(shootout), 1L).draw()).isEqualTo(1);
    }

    @Test
    void summarize_skipsUnscoredMatches() {
        Match unscored = Match.builder().teamA(PSG).teamB(OM).status(Match.Status.FINISHED).build();

        TeamSummaryResponse summary = TeamForm.summarize(List.of(unscored), 1L);

        assertThat(summary.won() + summary.draw() + summary.lost()).isZero();
    }
}
