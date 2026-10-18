package com.pronocore.service;

import com.pronocore.dto.response.MatchOutcome;
import com.pronocore.dto.response.TeamDetailResponse;
import com.pronocore.entity.Competition;
import com.pronocore.entity.Match;
import com.pronocore.entity.Team;
import com.pronocore.mapper.MatchMapper;
import com.pronocore.repository.MatchRepository;
import com.pronocore.repository.TeamRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamServiceTest {

    @Mock private TeamRepository teamRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private MatchMapper matchMapper;

    @InjectMocks
    private TeamService teamService;

    private static final Team PSG = Team.builder().id(1L).name("PSG").build();
    private static final Team OM = Team.builder().id(2L).name("OM").build();

    private static Match match(int scoreA, int scoreB, int day, long competitionId) {
        return Match.builder()
                .teamA(PSG).teamB(OM)
                .scoreA(scoreA).scoreB(scoreB)
                .status(Match.Status.FINISHED)
                .matchDate(LocalDateTime.of(2026, 9, day, 20, 0))
                .competition(Competition.builder().id(competitionId).name("C" + competitionId).build())
                .build();
    }

    @Test
    void getTeamById_unknownTeam_throws() {
        when(teamRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> teamService.getTeamById(99L)).isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void getTeamById_summaryMixesAllCompetitions_withoutRanking() {
        when(teamRepository.findById(1L)).thenReturn(Optional.of(PSG));
        // newest first: a cup loss, then two league wins
        when(matchRepository.findFinishedByTeam(1L)).thenReturn(List.of(
                match(0, 1, 3, 11L), match(2, 0, 2, 10L), match(1, 0, 1, 10L)));

        TeamDetailResponse team = teamService.getTeamById(1L);

        assertThat(team.name()).isEqualTo("PSG");
        assertThat(team.summary().won()).isEqualTo(2);
        assertThat(team.summary().lost()).isEqualTo(1);
        assertThat(team.summary().recent()).containsExactly(MatchOutcome.L, MatchOutcome.W, MatchOutcome.W);
        assertThat(team.summary().ranking()).isNull();
    }
}
