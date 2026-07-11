package com.pronocore.service;

import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.dto.request.F1PredictionRequest;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class F1RaceServiceTest {

    @Mock private RaceRepository raceRepository;
    @Mock private RaceResultRepository raceResultRepository;
    @Mock private DriverRepository driverRepository;
    @Mock private F1PredictionRepository predictionRepository;
    @Mock private BetRepository betRepository;
    @Mock private BetParticipationRepository participationRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private UserRepository userRepository;
    @Mock private GroupMemberGuard groupMemberGuard;
    @Mock private CompetitionRepository competitionRepository;

    @InjectMocks
    private F1RaceService f1RaceService;

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
    private F1RaceService.RaceOutcome outcome() {
        return F1RaceService.RaceOutcome.from(List.of(
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
        assertThat(f1RaceService.computePoints(p, outcome())).isEqualTo(14);
    }

    @Test
    void computePoints_podiumRightDriversWrongOrder_scoresOnePerDriver() {
        F1Prediction p = prediction(lec, nor, pia, null, null, null);
        assertThat(f1RaceService.computePoints(p, outcome())).isEqualTo(3);
    }

    @Test
    void computePoints_partialPodium_mixesExactAndWrongSlot() {
        // P1 exact (3) + LEC on podium but wrong slot (1), HAM not on podium (0)
        F1Prediction p = prediction(nor, lec, ham, null, null, null);
        assertThat(f1RaceService.computePoints(p, outcome())).isEqualTo(4);
    }

    @Test
    void computePoints_poleAndFastestLapWithoutP1_noChelemBonus() {
        // pole (2) + fastest lap (1) + podium all wrong (VER dnf, HAM 4th, BOT 5th)
        F1Prediction p = prediction(ver, ham, bot, nor, ham, null);
        assertThat(f1RaceService.computePoints(p, outcome())).isEqualTo(3);
    }

    @Test
    void computePoints_lastClassifiedIgnoresDnf() {
        // VER retired without classification — BOT (P5) is the lanterne rouge
        F1Prediction wrongLast = prediction(ham, ver, bot, null, null, ver);
        F1Prediction rightLast = prediction(ham, ver, bot, null, null, bot);
        assertThat(f1RaceService.computePoints(wrongLast, outcome())).isEqualTo(0);
        assertThat(f1RaceService.computePoints(rightLast, outcome())).isEqualTo(2);
    }

    @Test
    void computePoints_nullPicks_scoreZeroSafely() {
        F1Prediction p = prediction(bot, ham, ver, null, null, null);
        assertThat(f1RaceService.computePoints(p, outcome())).isEqualTo(0);
    }

    @Test
    void fiaPoints_matchesOfficialScale() {
        assertThat(F1RaceService.fiaPoints(1)).isEqualTo(25);
        assertThat(F1RaceService.fiaPoints(10)).isEqualTo(1);
        assertThat(F1RaceService.fiaPoints(11)).isEqualTo(0);
        assertThat(F1RaceService.fiaPoints(null)).isEqualTo(0);
    }

    // ── predict — deadlines ───────────────────────────────────────────────────

    private Race raceAt(LocalDateTime quali, LocalDateTime raceDate) {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        return Race.builder().id(100L).name("GP Test").round(1)
                .qualifyingDate(quali).raceDate(raceDate).competition(competition).build();
    }

    private User user(Long id, String username) {
        return User.builder().id(id).username(username).build();
    }

    private F1PredictionRequest request(Long p1, Long p2, Long p3, Long pole) {
        F1PredictionRequest r = new F1PredictionRequest();
        r.setP1DriverId(p1);
        r.setP2DriverId(p2);
        r.setP3DriverId(p3);
        r.setPoleDriverId(pole);
        return r;
    }

    @Test
    void predict_afterRaceStart_isRejected() {
        User alice = user(1L, "alice");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(
                raceAt(LocalDateTime.now().minusDays(1), LocalDateTime.now().minusHours(1))));

        assertThatThrownBy(() -> f1RaceService.predict(100L, request(1L, 2L, 3L, null), "alice"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("course a déjà commencé");
    }

    @Test
    void predict_duplicatePodiumDrivers_isRejected() {
        User alice = user(1L, "alice");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(
                raceAt(LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(2))));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));

        assertThatThrownBy(() -> f1RaceService.predict(100L, request(1L, 1L, 1L, null), "alice"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("trois pilotes différents");
    }

    @Test
    void predict_afterQualifying_freezesPolePick() {
        User alice = user(1L, "alice");
        Race race = raceAt(LocalDateTime.now().minusHours(2), LocalDateTime.now().plusDays(1));
        Group group = Group.builder().id(7L).name("g").build();
        Bet bet = Bet.builder().id(50L).group(group).race(race).status(Bet.Status.OPEN).build();
        BetParticipation existing = BetParticipation.builder().id(60L).bet(bet).user(alice).chosenOption("x").build();
        F1Prediction stored = prediction(nor, pia, lec, lec /* pole picked before quali */, null, null);
        stored.setParticipation(existing);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));
        when(driverRepository.findById(2L)).thenReturn(Optional.of(pia));
        when(driverRepository.findById(3L)).thenReturn(Optional.of(lec));
        when(driverRepository.findById(4L)).thenReturn(Optional.of(ham));
        when(betRepository.findByRaceIdInUserActiveGroups(100L, 1L)).thenReturn(List.of(bet));
        when(participationRepository.findByBetIdAndUserId(50L, 1L)).thenReturn(Optional.of(existing));
        when(predictionRepository.findByParticipationId(60L)).thenReturn(Optional.of(stored));
        when(participationRepository.save(any(BetParticipation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(predictionRepository.save(any(F1Prediction.class))).thenAnswer(inv -> inv.getArgument(0));

        // Player tries to switch pole to HAM (id 4) after qualifying started
        var response = f1RaceService.predict(100L, request(1L, 2L, 3L, 4L), "alice");

        // Pole stays LEC, everything else updates
        assertThat(response.getPole().getId()).isEqualTo(lec.getId());
        assertThat(response.isPoleLocked()).isTrue();
        assertThat(response.isRaceLocked()).isFalse();
    }

    @Test
    void predict_withoutOpenBet_isRejected() {
        User alice = user(1L, "alice");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(
                raceAt(LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(2))));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));
        when(driverRepository.findById(2L)).thenReturn(Optional.of(pia));
        when(driverRepository.findById(3L)).thenReturn(Optional.of(lec));
        when(betRepository.findByRaceIdInUserActiveGroups(100L, 1L)).thenReturn(List.of());

        assertThatThrownBy(() -> f1RaceService.predict(100L, request(1L, 2L, 3L, null), "alice"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ouverte aux paris dans aucun");
    }

    // ── enterResults — settlement ─────────────────────────────────────────────

    @Test
    void enterResults_settlesOpenBetsAndWritesPointsEarned() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));
        Group group = Group.builder().id(7L).name("g").build();
        Bet bet = Bet.builder().id(50L).group(group).race(race).status(Bet.Status.OPEN).build();
        User alice = user(1L, "alice");
        BetParticipation participation = BetParticipation.builder().id(60L).bet(bet).user(alice).chosenOption("x").build();
        F1Prediction alicePrediction = prediction(nor, pia, lec, nor, ham, bot);   // perfect → 14
        alicePrediction.setParticipation(participation);

        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));
        when(driverRepository.findById(2L)).thenReturn(Optional.of(pia));
        when(driverRepository.findById(3L)).thenReturn(Optional.of(lec));
        when(driverRepository.findById(4L)).thenReturn(Optional.of(ham));
        when(driverRepository.findById(6L)).thenReturn(Optional.of(bot));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(100L, Bet.Status.OPEN)).thenReturn(List.of(bet));
        when(betRepository.findByRaceIdAndStatusOrderByCreatedAtDesc(100L, Bet.Status.VALIDATED)).thenReturn(List.of());
        when(participationRepository.findByBetId(50L)).thenReturn(List.of(participation));
        when(predictionRepository.findByParticipationId(60L)).thenReturn(Optional.of(alicePrediction));
        when(participationRepository.save(any(BetParticipation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));
        when(raceResultRepository.findByRaceIdWithDrivers(100L)).thenReturn(List.of());

        EnterRaceResultsRequest request = new EnterRaceResultsRequest();
        request.setResults(List.of(
                entry(1L, 1, true, false, false),
                entry(2L, 2, false, false, false),
                entry(3L, 3, false, false, false),
                entry(4L, 4, false, true, false),
                entry(6L, 5, false, false, false)
        ));

        f1RaceService.enterResults(100L, request);

        assertThat(race.getStatus()).isEqualTo(Race.Status.FINISHED);
        assertThat(participation.getPointsEarned()).isEqualTo(14);
        assertThat(bet.getStatus()).isEqualTo(Bet.Status.VALIDATED);
        assertThat(bet.getWinningOption()).contains("NOR · PIA · LEC");
        verify(raceResultRepository).deleteByRaceId(100L);
        verify(raceResultRepository).saveAll(anyList());
    }

    @Test
    void enterResults_withoutFullPodium_isRejected() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));

        EnterRaceResultsRequest request = new EnterRaceResultsRequest();
        request.setResults(List.of(entry(1L, 1, true, false, false), entry(2L, 2, false, false, false)));

        assertThatThrownBy(() -> f1RaceService.enterResults(100L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positions 1, 2 and 3");
        verify(raceResultRepository, never()).deleteByRaceId(anyLong());
    }

    @Test
    void enterResults_duplicatePosition_isRejected() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));

        EnterRaceResultsRequest request = new EnterRaceResultsRequest();
        request.setResults(List.of(entry(1L, 1, false, false, false), entry(2L, 1, false, false, false)));

        assertThatThrownBy(() -> f1RaceService.enterResults(100L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Duplicate position");
    }

    private EnterRaceResultsRequest.Entry entry(Long driverId, Integer position, boolean pole, boolean fl, boolean dnf) {
        EnterRaceResultsRequest.Entry e = new EnterRaceResultsRequest.Entry();
        e.setDriverId(driverId);
        e.setPosition(position);
        e.setPole(pole);
        e.setFastestLap(fl);
        e.setDnf(dnf);
        return e;
    }

    // ── openRaceForBetting — sport gating ─────────────────────────────────────

    @Test
    void openRaceForBetting_inFootOnlyGroup_isRejected() {
        User admin = user(1L, "admin");
        Group footGroup = Group.builder().id(7L).name("g").build();   // defaults to FOOT only

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(groupRepository.findById(7L)).thenReturn(Optional.of(footGroup));

        assertThatThrownBy(() -> f1RaceService.openRaceForBetting(7L, 100L, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ne joue pas à la F1");
    }

    @Test
    void openRaceForBetting_createsRacePicksBet() {
        User admin = user(1L, "admin");
        Group group = Group.builder().id(7L).name("g").build();
        group.getSports().add(Sport.F1);
        Race race = raceAt(LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(2));

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));
        when(betRepository.existsByRaceIdAndGroupId(100L, 7L)).thenReturn(false);
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = f1RaceService.openRaceForBetting(7L, 100L, "admin");

        assertThat(response.getBetType()).isEqualTo(Bet.BetType.RACE_PICKS);
        assertThat(response.getDeadline()).isEqualTo(race.getRaceDate());
        verify(groupMemberGuard).requireGroupAdmin(7L, 1L);
    }

    @Test
    void openRaceForBetting_alreadyOpen_isRejected() {
        User admin = user(1L, "admin");
        Group group = Group.builder().id(7L).name("g").build();
        group.getSports().add(Sport.F1);

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(
                raceAt(LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(2))));
        when(betRepository.existsByRaceIdAndGroupId(100L, 7L)).thenReturn(true);

        assertThatThrownBy(() -> f1RaceService.openRaceForBetting(7L, 100L, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already open");
    }
}
