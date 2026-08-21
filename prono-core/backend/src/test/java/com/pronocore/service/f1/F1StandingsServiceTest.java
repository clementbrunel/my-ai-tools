package com.pronocore.service.f1;

import com.pronocore.entity.*;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.RaceResultRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class F1StandingsServiceTest {

    @Mock private RaceResultRepository raceResultRepository;
    @Mock private CompetitionRepository competitionRepository;

    @InjectMocks
    private F1StandingsService f1StandingsService;

    private final Constructor mclaren = Constructor.builder().id(1L).name("McLaren").color("#FF8000").build();

    private Driver driver(Long id, String code, Constructor constructor) {
        return Driver.builder().id(id).code(code).name(code).number(id.intValue()).constructor(constructor).build();
    }

    private final Driver nor = driver(1L, "NOR", mclaren);
    private final Driver pia = driver(2L, "PIA", mclaren);

    private RaceResult result(Driver d, Integer position) {
        return RaceResult.builder().driver(d).constructor(d.getConstructor()).position(position).build();
    }

    // ── FIA scale ──────────────────────────────────────────────────────────────

    @Test
    void fiaPoints_matchesOfficialScale() {
        assertThat(F1StandingsService.fiaPoints(1)).isEqualTo(25);
        assertThat(F1StandingsService.fiaPoints(10)).isEqualTo(1);
        assertThat(F1StandingsService.fiaPoints(11)).isEqualTo(0);
        assertThat(F1StandingsService.fiaPoints(null)).isEqualTo(0);
    }

    @Test
    void fiaSprintPoints_matchesOfficialScale() {
        assertThat(F1StandingsService.fiaSprintPoints(1)).isEqualTo(8);
        assertThat(F1StandingsService.fiaSprintPoints(8)).isEqualTo(1);
        assertThat(F1StandingsService.fiaSprintPoints(9)).isEqualTo(0);
        assertThat(F1StandingsService.fiaSprintPoints(null)).isEqualTo(0);
    }

    @Test
    void driverStandings_addSprintPointsToRacePoints() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        // NOR: P1 course (25) + P2 sprint (7) = 32 ; PIA: P2 course (18) + P1 sprint (8) = 26
        RaceResult norResult = result(nor, 1); norResult.setSprintPosition(2);
        RaceResult piaResult = result(pia, 2); piaResult.setSprintPosition(1);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceResultRepository.findByCompetitionIdWithDrivers(9L)).thenReturn(List.of(norResult, piaResult));

        var standings = f1StandingsService.getDriverStandings();

        assertThat(standings.get(0).getDriver().getCode()).isEqualTo("NOR");
        assertThat(standings.get(0).getPoints()).isEqualTo(32);
        assertThat(standings.get(1).getPoints()).isEqualTo(26);
    }

    // ── standings history — cumulative points per round ───────────────────────

    private Race raceRound(Long id, int round) {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        return Race.builder().id(id).name("GP " + round).round(round).competition(competition)
                .qualifyingDate(LocalDateTime.now()).raceDate(LocalDateTime.now()).build();
    }

    private RaceResult resultAt(Race race, Driver d, Integer position) {
        return RaceResult.builder().race(race).driver(d).constructor(d.getConstructor()).position(position).build();
    }

    private RaceResult resultAt(Race race, Driver d, Integer position, Constructor racedFor) {
        return RaceResult.builder().race(race).driver(d).constructor(racedFor).position(position).build();
    }

    @Test
    void driverStandingsHistory_accumulatesPointsInRoundOrder() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        // Rounds inserted out of order — history must still walk them 1, then 2.
        Race round2 = raceRound(101L, 2);
        Race round1 = raceRound(100L, 1);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceResultRepository.findByCompetitionIdWithDrivers(9L)).thenReturn(List.of(
                resultAt(round2, nor, 2),   // round 2: NOR P2 (18)
                resultAt(round2, pia, 1),   // round 2: PIA P1 (25)
                resultAt(round1, nor, 1),   // round 1: NOR P1 (25)
                resultAt(round1, pia, 2)    // round 1: PIA P2 (18)
        ));

        var history = f1StandingsService.getDriverStandingsHistory();

        assertThat(history.getRaces()).extracting("round").containsExactly(1, 2);

        var norSeries = history.getSeries().stream().filter(s -> s.getLabel().equals("NOR")).findFirst().orElseThrow();
        assertThat(norSeries.getPoints()).containsExactly(25, 43); // 25, then +18
        var piaSeries = history.getSeries().stream().filter(s -> s.getLabel().equals("PIA")).findFirst().orElseThrow();
        assertThat(piaSeries.getPoints()).containsExactly(18, 43); // 18, then +25
    }

    @Test
    void driverStandingsHistory_limitsSeriesToTopTen() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        Race round1 = raceRound(100L, 1);

        Constructor c = Constructor.builder().id(3L).name("Alpine").color("#00A1E8").build();
        List<RaceResult> results = new java.util.ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            results.add(resultAt(round1, driver((long) (10 + i), "D" + i, c), i));
        }

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceResultRepository.findByCompetitionIdWithDrivers(9L)).thenReturn(results);

        var history = f1StandingsService.getDriverStandingsHistory();

        assertThat(history.getSeries()).hasSize(10);
        assertThat(history.getSeries().get(0).getLabel()).isEqualTo("D1"); // P1 scores highest, ranked first
    }

    @Test
    void constructorStandingsHistory_sumsBothDriversOfATeam() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        Race round1 = raceRound(100L, 1);
        Constructor ferrari = Constructor.builder().id(2L).name("Ferrari").color("#E8002D").build();
        Driver lec = driver(3L, "LEC", ferrari);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceResultRepository.findByCompetitionIdWithDrivers(9L)).thenReturn(List.of(
                resultAt(round1, nor, 1),  // McLaren P1 (25)
                resultAt(round1, pia, 2),  // McLaren P2 (18)
                resultAt(round1, lec, 3)   // Ferrari P3 (15)
        ));

        var history = f1StandingsService.getConstructorStandingsHistory();

        var mclarenSeries = history.getSeries().stream().filter(s -> s.getLabel().equals("McLaren")).findFirst().orElseThrow();
        assertThat(mclarenSeries.getPoints()).containsExactly(43); // 25 + 18 combined
    }

    // ── one-race loan: a driver's current team must not reattribute past results ──

    @Test
    void constructorStandings_useThePerRaceSnapshot_notTheDriversCurrentTeam() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        Race round1 = raceRound(100L, 1);
        Race round2 = raceRound(101L, 2);
        Constructor racingBulls = Constructor.builder().id(4L).name("Racing Bulls").color("#6692FF").build();
        Constructor redBull = Constructor.builder().id(5L).name("Red Bull").color("#3671C6").build();
        // A driver whose CURRENT constructor is Red Bull (e.g. after a mid-season loan was
        // recorded on their driver row) but who raced round 1 for Racing Bulls.
        Driver loanedDriver = driver(9L, "LAW", redBull);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceResultRepository.findByCompetitionIdWithDrivers(9L)).thenReturn(List.of(
                resultAt(round1, loanedDriver, 1, racingBulls),  // round 1: raced for Racing Bulls (25 pts)
                resultAt(round2, loanedDriver, 1, redBull)       // round 2: raced for Red Bull (25 pts)
        ));

        var standings = f1StandingsService.getConstructorStandings();

        var racingBullsRow = standings.stream().filter(s -> s.getConstructorName().equals("Racing Bulls")).findFirst().orElseThrow();
        var redBullRow = standings.stream().filter(s -> s.getConstructorName().equals("Red Bull")).findFirst().orElseThrow();
        assertThat(racingBullsRow.getPoints()).isEqualTo(25);   // round 1 stays Racing Bulls's, even though the driver is now at Red Bull
        assertThat(redBullRow.getPoints()).isEqualTo(25);       // round 2 correctly credited to Red Bull
    }
}
