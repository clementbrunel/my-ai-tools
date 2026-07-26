package com.pronocore.service.f1;

import com.pronocore.entity.*;
import com.pronocore.repository.BetParticipationRepository;
import com.pronocore.repository.BetRepository;
import com.pronocore.repository.F1PredictionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class F1ScoringServiceTest {

    @Mock private BetRepository betRepository;
    @Mock private BetParticipationRepository participationRepository;
    @Mock private F1PredictionRepository predictionRepository;

    @InjectMocks
    private F1ScoringService f1ScoringService;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private final Constructor mclaren = Constructor.builder().id(1L).name("McLaren").color("#FF8000").build();
    private final Constructor ferrari = Constructor.builder().id(2L).name("Ferrari").color("#E8002D").build();

    private final Driver nor = driver(1L, "NOR", mclaren);
    private final Driver pia = driver(2L, "PIA", mclaren);
    private final Driver lec = driver(3L, "LEC", ferrari);
    private final Driver ham = driver(4L, "HAM", ferrari);
    private final Driver ver = driver(5L, "VER", ferrari);
    private final Driver bot = driver(6L, "BOT", ferrari);

    private Driver driver(Long id, String code, Constructor constructor) {
        return Driver.builder().id(id).code(code).name(code).number(id.intValue()).constructor(constructor).build();
    }

    /** Actual outcome: NOR wins, PIA 2nd, LEC 3rd, pole NOR, fastest lap HAM, last classified BOT. */
    private RaceOutcome outcome() {
        return RaceOutcome.from(List.of(
                result(nor, 1, true, false),
                result(pia, 2, false, false),
                result(lec, 3, false, false),
                result(ham, 4, false, true),
                result(bot, 5, false, false),
                result(ver, null, false, false)   // DNF, not classified
        ));
    }

    private RaceResult result(Driver d, Integer position, boolean pole, boolean fastestLap) {
        return RaceResult.builder().driver(d).position(position).pole(pole).fastestLap(fastestLap).build();
    }

    private F1Prediction prediction(Driver p1, Driver p2, Driver p3, Driver pole, Driver fl, Driver last) {
        return F1Prediction.builder().p1(p1).p2(p2).p3(p3).pole(pole).fastestLap(fl).lastClassified(last).build();
    }

    // ── computePoints — formule "Podium +" ────────────────────────────────────

    @Test
    void computePoints_perfectPrediction_scoresMax14() {
        // Podium exact (3+2+2) + pole (2) + fastest lap (1) + last (2) + grand chelem (2)
        F1Prediction p = prediction(nor, pia, lec, nor, ham, bot);
        assertThat(F1Scoring.computePoints(p, outcome())).isEqualTo(14);
    }

    @Test
    void computePoints_podiumRightDriversWrongOrder_scoresOnePerDriver() {
        F1Prediction p = prediction(lec, nor, pia, null, null, null);
        assertThat(F1Scoring.computePoints(p, outcome())).isEqualTo(3);
    }

    @Test
    void computePoints_partialPodium_mixesExactAndWrongSlot() {
        // P1 exact (3) + LEC on podium but wrong slot (1), HAM not on podium (0)
        F1Prediction p = prediction(nor, lec, ham, null, null, null);
        assertThat(F1Scoring.computePoints(p, outcome())).isEqualTo(4);
    }

    @Test
    void computePoints_poleAndFastestLapWithoutP1_noChelemBonus() {
        // pole (2) + fastest lap (1) + podium all wrong (VER dnf, HAM 4th, BOT 5th)
        F1Prediction p = prediction(ver, ham, bot, nor, ham, null);
        assertThat(F1Scoring.computePoints(p, outcome())).isEqualTo(3);
    }

    @Test
    void computePoints_lastClassifiedIgnoresDnf() {
        // VER retired without classification — BOT (P5) is the lanterne rouge
        F1Prediction wrongLast = prediction(ham, ver, bot, null, null, ver);
        F1Prediction rightLast = prediction(ham, ver, bot, null, null, bot);
        assertThat(F1Scoring.computePoints(wrongLast, outcome())).isEqualTo(0);
        assertThat(F1Scoring.computePoints(rightLast, outcome())).isEqualTo(2);
    }

    @Test
    void computePoints_nullPicks_scoreZeroSafely() {
        F1Prediction p = prediction(bot, ham, ver, null, null, null);
        assertThat(F1Scoring.computePoints(p, outcome())).isEqualTo(0);
    }

    @Test
    void summarize_listsPodiumAndSpecialPicks() {
        F1Prediction p = prediction(nor, pia, lec, nor, ham, bot);
        assertThat(F1Scoring.summarize(p)).isEqualTo("NOR · PIA · LEC | pole NOR | mt HAM | der BOT");
    }

    // ── settleBetsForRace — settlement ────────────────────────────────────────

    private Race raceAt(LocalDateTime quali, LocalDateTime raceDate) {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        return Race.builder().id(100L).name("GP Test").round(1)
                .qualifyingDate(quali).raceDate(raceDate).competition(competition).build();
    }

    @Test
    void settleBetsForRace_writesPointsEarnedAndValidatesBets() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));
        Group group = Group.builder().id(7L).name("g").build();
        Bet bet = Bet.builder().id(50L).group(group).race(race).status(Bet.Status.OPEN).build();
        User alice = User.builder().id(1L).username("alice").build();
        BetParticipation participation = BetParticipation.builder().id(60L).bet(bet).user(alice).chosenOption("x").build();
        F1Prediction alicePrediction = prediction(nor, pia, lec, nor, ham, bot);   // perfect → 14
        alicePrediction.setParticipation(participation);

        List<RaceResult> results = List.of(
                result(nor, 1, true, false),
                result(pia, 2, false, false),
                result(lec, 3, false, false),
                result(ham, 4, false, true),
                result(bot, 5, false, false)
        );

        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(100L, Bet.Status.OPEN)).thenReturn(List.of(bet));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(100L, Bet.Status.VALIDATED)).thenReturn(List.of());
        when(participationRepository.findByBetId(50L)).thenReturn(List.of(participation));
        when(predictionRepository.findByRaceId(100L)).thenReturn(List.of(alicePrediction));
        when(participationRepository.save(any(BetParticipation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));

        f1ScoringService.settleBetsForRace(race, results);

        assertThat(participation.getPointsEarned()).isEqualTo(14);
        assertThat(bet.getStatus()).isEqualTo(Bet.Status.VALIDATED);
        assertThat(bet.getWinningOption()).contains("NOR · PIA · LEC");
    }
}
