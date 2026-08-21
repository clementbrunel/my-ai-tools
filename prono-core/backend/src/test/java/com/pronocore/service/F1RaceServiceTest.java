package com.pronocore.service;

import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.dto.request.F1PredictionRequest;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.f1.F1ScoringService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
    @Mock private QualifyingResultRepository qualifyingResultRepository;
    @Mock private DriverRepository driverRepository;
    @Mock private ConstructorRepository constructorRepository;
    @Mock private F1PredictionRepository predictionRepository;
    @Mock private BetRepository betRepository;
    @Mock private BetParticipationRepository participationRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private UserRepository userRepository;
    @Mock private GroupMemberGuard groupMemberGuard;
    @Mock private CompetitionRepository competitionRepository;
    @Mock private DailyGageService dailyGageService;
    @Mock private com.pronocore.mapper.BetMapper betMapper;
    @Mock private F1ScoringService f1ScoringService;

    @InjectMocks
    private F1RaceService f1RaceService;

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private final Constructor mclaren = Constructor.builder().id(1L).name("McLaren").color("#FF8000").build();
    private final Constructor ferrari = Constructor.builder().id(2L).name("Ferrari").color("#E8002D").build();

    private final Driver nor = driver(1L, "NOR", mclaren);
    private final Driver pia = driver(2L, "PIA", mclaren);
    private final Driver lec = driver(3L, "LEC", ferrari);
    private final Driver ham = driver(4L, "HAM", ferrari);
    private final Driver bot = driver(6L, "BOT", ferrari);

    private Driver driver(Long id, String code, Constructor constructor) {
        return Driver.builder().id(id).code(code).name(code).number(id.intValue()).constructor(constructor).build();
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
        F1Prediction stored = F1Prediction.builder().p1(nor).p2(pia).p3(lec).pole(lec /* pole picked before quali */).build();
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

    // ── enterResults — orchestration (settlement math lives in F1ScoringServiceTest) ──

    @Test
    void enterResults_storesResultsAndDelegatesSettlement() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));

        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));
        when(driverRepository.findById(2L)).thenReturn(Optional.of(pia));
        when(driverRepository.findById(3L)).thenReturn(Optional.of(lec));
        when(driverRepository.findById(4L)).thenReturn(Optional.of(ham));
        when(driverRepository.findById(6L)).thenReturn(Optional.of(bot));
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
        verify(dailyGageService).onMatchSettled(race.getRaceDate().toLocalDate());
        verify(raceResultRepository).deleteByRaceId(100L);
        verify(raceResultRepository).saveAll(anyList());

        ArgumentCaptor<List<RaceResult>> resultsCaptor = ArgumentCaptor.forClass(List.class);
        verify(f1ScoringService).settleBetsForRace(eq(race), resultsCaptor.capture());
        assertThat(resultsCaptor.getValue()).extracting(rr -> rr.getDriver().getCode())
                .containsExactly("NOR", "PIA", "LEC", "HAM", "BOT");
        // No override supplied: every result snapshots the driver's own (current) constructor.
        assertThat(resultsCaptor.getValue()).extracting(RaceResult::getConstructor)
                .containsExactly(mclaren, mclaren, ferrari, ferrari, ferrari);
        verifyNoInteractions(constructorRepository);
    }

    /**
     * A one-off single-race loan: the admin flags a driver as racing for another team just for
     * this GP by overriding the entry's constructorId. This must not touch driver.constructor
     * (their season-long team) — it only lands on this race's snapshot.
     */
    @Test
    void enterResults_withConstructorOverride_snapshotsTheOverrideNotTheDriversOwnTeam() {
        Race race = raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1));
        Constructor redBull = Constructor.builder().id(3L).name("Red Bull").color("#3671C6").build();

        when(raceRepository.findById(100L)).thenReturn(Optional.of(race));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(nor));   // home team: McLaren
        when(driverRepository.findById(2L)).thenReturn(Optional.of(pia));
        when(driverRepository.findById(3L)).thenReturn(Optional.of(lec));
        when(constructorRepository.findById(3L)).thenReturn(Optional.of(redBull));
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));
        when(raceResultRepository.findByRaceIdWithDrivers(100L)).thenReturn(List.of());

        EnterRaceResultsRequest.Entry norLoanedToRedBull = entry(1L, 1, true, false, false);
        norLoanedToRedBull.setConstructorId(3L);

        EnterRaceResultsRequest request = new EnterRaceResultsRequest();
        request.setResults(List.of(
                norLoanedToRedBull,
                entry(2L, 2, false, false, false),
                entry(3L, 3, false, false, false)
        ));

        f1RaceService.enterResults(100L, request);

        ArgumentCaptor<List<RaceResult>> resultsCaptor = ArgumentCaptor.forClass(List.class);
        verify(f1ScoringService).settleBetsForRace(eq(race), resultsCaptor.capture());
        RaceResult norResult = resultsCaptor.getValue().stream()
                .filter(rr -> rr.getDriver().getCode().equals("NOR")).findFirst().orElseThrow();
        assertThat(norResult.getConstructor()).isEqualTo(redBull);   // this race only
        assertThat(nor.getConstructor()).isEqualTo(mclaren);         // driver's own team, untouched
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
        when(betMapper.toResponse(any(Bet.class))).thenAnswer(inv -> {
            Bet b = inv.getArgument(0);
            return com.pronocore.dto.response.BetResponse.builder()
                    .betType(b.getBetType()).deadline(b.getDeadline()).build();
        });

        var response = f1RaceService.openRaceForBetting(7L, 100L, "admin");

        assertThat(response.getBetType()).isEqualTo(Bet.BetType.RACE_PICKS);
        assertThat(response.getDeadline()).isEqualTo(race.getRaceDate());
        verify(groupMemberGuard).requireGroupAdmin(7L, 1L);
    }

    @Test
    void openRaceForBetting_pastRace_isRejected() {
        User admin = user(1L, "admin");
        Group group = Group.builder().id(7L).name("g").build();
        group.getSports().add(Sport.F1);

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        when(groupRepository.findById(7L)).thenReturn(Optional.of(group));
        when(raceRepository.findById(100L)).thenReturn(Optional.of(
                raceAt(LocalDateTime.now().minusDays(2), LocalDateTime.now().minusDays(1))));

        assertThatThrownBy(() -> f1RaceService.openRaceForBetting(7L, 100L, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("déjà partie ou terminée");
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
