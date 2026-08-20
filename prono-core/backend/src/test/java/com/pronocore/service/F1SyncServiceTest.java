package com.pronocore.service;

import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.f1.F1SyncService;
import com.pronocore.service.f1.JolpicaClient;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class F1SyncServiceTest {

    @Mock private JolpicaClient jolpicaClient;
    @Mock private CompetitionRepository competitionRepository;
    @Mock private RaceRepository raceRepository;
    @Mock private QualifyingResultRepository qualifyingResultRepository;
    @Mock private DriverRepository driverRepository;
    @Mock private ConstructorRepository constructorRepository;
    @Mock private BetRepository betRepository;
    @Mock private F1RaceService f1RaceService;

    @InjectMocks
    private F1SyncService f1SyncService;

    private static final String CALENDAR_JSON = """
        {"MRData":{"RaceTable":{"Races":[
          {"round":"1","raceName":"Australian Grand Prix","date":"2026-03-08","time":"04:00:00Z",
           "Circuit":{"circuitName":"Albert Park","Location":{"country":"Australia"}},
           "Qualifying":{"date":"2026-03-07","time":"05:00:00Z"}},
          {"round":"2","raceName":"Chinese Grand Prix","date":"2026-03-15","time":"07:00:00Z",
           "Circuit":{"circuitName":"Shanghai","Location":{"country":"China"}},
           "Qualifying":{"date":"2026-03-14","time":"07:00:00Z"}}
        ]}}}""";

    private static final String ROUND1_RESULTS_JSON = """
        {"MRData":{"RaceTable":{"Races":[{"Results":[
          {"positionText":"1","status":"Finished",
           "Driver":{"code":"RUS","permanentNumber":"63","givenName":"George","familyName":"Russell"},
           "Constructor":{"name":"Mercedes"},
           "FastestLap":{"rank":"1"}},
          {"positionText":"2","status":"+5.3s",
           "Driver":{"code":"ANT","permanentNumber":"12","givenName":"Kimi","familyName":"Antonelli"},
           "Constructor":{"name":"Mercedes"}},
          {"positionText":"3","status":"+12.1s",
           "Driver":{"code":"NOR","permanentNumber":"4","givenName":"Lando","familyName":"Norris"},
           "Constructor":{"name":"McLaren"}},
          {"positionText":"R","status":"Engine",
           "Driver":{"code":"VER","permanentNumber":"33","givenName":"Max","familyName":"Verstappen"},
           "Constructor":{"name":"Red Bull"}}
        ]}]}}}""";

    // NOR is eliminated in Q2 with a Q2 lap (1:21.100) numerically faster than RUS's Q3 lap
    // (1:21.450, e.g. changing weather) — grid time must still come from each driver's own
    // last session reached, never compared against another driver's session.
    private static final String ROUND1_QUALI_JSON = """
        {"MRData":{"RaceTable":{"Races":[{"QualifyingResults":[
          {"position":"1","Driver":{"code":"ANT","permanentNumber":"12","givenName":"Kimi","familyName":"Antonelli"},
           "Constructor":{"name":"Mercedes"},"Q1":"1:22.500","Q2":"1:21.800","Q3":"1:21.203"},
          {"position":"2","Driver":{"code":"RUS","permanentNumber":"63","givenName":"George","familyName":"Russell"},
           "Constructor":{"name":"Mercedes"},"Q1":"1:22.700","Q2":"1:22.000","Q3":"1:21.450"},
          {"position":"3","Driver":{"code":"NOR","permanentNumber":"4","givenName":"Lando","familyName":"Norris"},
           "Constructor":{"name":"McLaren"},"Q1":"1:22.900","Q2":"1:21.100"},
          {"position":"4","Driver":{"code":"VER","permanentNumber":"33","givenName":"Max","familyName":"Verstappen"},
           "Constructor":{"name":"Red Bull"},"Q1":"1:23.000"}
        ]}]}}}""";

    private static final String ROUND1_SPRINT_JSON = """
        {"MRData":{"RaceTable":{"Races":[{"SprintResults":[
          {"positionText":"1","Driver":{"code":"NOR"}},
          {"positionText":"2","Driver":{"code":"RUS"}}
        ]}]}}}""";

    private static final String EMPTY_RESULTS_JSON = """
        {"MRData":{"RaceTable":{"Races":[]}}}""";

    private Race race(long id, int round, Race.Status status, Competition competition) {
        return Race.builder().id(id).round(round).name("R" + round)
                .qualifyingDate(LocalDateTime.now().minusDays(2))
                .raceDate(LocalDateTime.now().minusDays(1))
                .status(status).competition(competition).build();
    }

    @Test
    void syncSeason_importsCalendarResultsAndSettles() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round1 = race(101L, 1, Race.Status.UPCOMING, competition);
        Race round2 = race(102L, 2, Race.Status.UPCOMING, competition);
        Race round3Seeded = race(103L, 3, Race.Status.UPCOMING, competition);   // not in the real calendar

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceRepository.findByCompetition_IdOrderByRaceDateAsc(9L))
                .thenReturn(List.of(round1, round2, round3Seeded));
        when(jolpicaClient.get("2026.json?limit=100")).thenReturn(CALENDAR_JSON);
        when(jolpicaClient.get("2026/1/qualifying.json?limit=40")).thenReturn(ROUND1_QUALI_JSON);
        when(jolpicaClient.get("2026/2/qualifying.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(jolpicaClient.get("2026/3/qualifying.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(jolpicaClient.get("2026/1/results.json?limit=40")).thenReturn(ROUND1_RESULTS_JSON);
        when(jolpicaClient.get("2026/1/sprint.json?limit=40")).thenReturn(ROUND1_SPRINT_JSON);
        when(jolpicaClient.get("2026/2/results.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(jolpicaClient.get("2026/3/results.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(betRepository.existsByRaceId(103L)).thenReturn(false);
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));
        // Pole lookup at settlement time now reads the stored grid instead of hitting jolpica again.
        when(qualifyingResultRepository.findByRaceIdWithDrivers(101L)).thenReturn(List.of(
                QualifyingResult.builder().position(1).driver(Driver.builder().code("ANT").build()).build()));

        stubEntryListUpserts();

        String summary = f1SyncService.syncSeason();

        // Calendar: names/dates converted from UTC to Paris time
        assertThat(round1.getName()).isEqualTo("GP d'Australie");
        assertThat(round1.getCountryIso2()).isEqualTo("AU");
        assertThat(round1.getRaceDate()).isEqualTo(LocalDateTime.parse("2026-03-08T05:00"));   // 04:00Z hiver = 05:00 Paris
        assertThat(round1.getQualifyingDate()).isEqualTo(LocalDateTime.parse("2026-03-07T06:00"));
        // Seeded round 3 not in the official calendar and without bets → deleted
        verify(raceRepository).delete(round3Seeded);

        // Qualifying grid: imported (replacing any prior grid) as soon as it's available,
        // independently of the race result — round 2/3 have no grid yet, nothing to store.
        verify(qualifyingResultRepository).deleteByRaceId(101L);
        ArgumentCaptor<List<QualifyingResult>> gridCaptor = ArgumentCaptor.forClass(List.class);
        verify(qualifyingResultRepository).saveAll(gridCaptor.capture());
        List<QualifyingResult> grid = gridCaptor.getValue();
        assertThat(grid).hasSize(4);
        // Each driver's own last session reached — never a cross-session comparison (NOR's Q2
        // lap is numerically faster than RUS's Q3 lap, yet each keeps their own session's time).
        assertThat(grid.get(0).getTime()).isEqualTo("1:21.203");   // ANT — reached Q3
        assertThat(grid.get(1).getTime()).isEqualTo("1:21.450");   // RUS — reached Q3
        assertThat(grid.get(2).getTime()).isEqualTo("1:21.100");   // NOR — eliminated in Q2
        assertThat(grid.get(3).getTime()).isEqualTo("1:23.000");   // VER — eliminated in Q1
        assertThat(summary).contains("grille de départ importée pour les manches [1]");

        // Results: settled through the same path as a manual entry
        ArgumentCaptor<EnterRaceResultsRequest> captor = ArgumentCaptor.forClass(EnterRaceResultsRequest.class);
        verify(f1RaceService).enterResults(eq(101L), captor.capture());
        List<EnterRaceResultsRequest.Entry> entries = captor.getValue().getResults();
        assertThat(entries).hasSize(4);
        assertThat(entries.get(0).getPosition()).isEqualTo(1);
        assertThat(entries.get(0).isFastestLap()).isTrue();     // RUS fastest lap
        assertThat(entries.get(0).isPole()).isFalse();
        assertThat(entries.get(1).isPole()).isTrue();           // ANT pole from qualifying
        assertThat(entries.get(3).getPosition()).isNull();      // VER retired → unclassified
        assertThat(entries.get(3).isDnf()).isTrue();
        // Sprint positions merged onto the weekend entries (RUS P2, NOR P1, others none)
        assertThat(entries.get(0).getSprintPosition()).isEqualTo(2);   // RUS
        assertThat(entries.get(2).getSprintPosition()).isEqualTo(1);   // NOR
        assertThat(entries.get(1).getSprintPosition()).isNull();       // ANT no sprint points
        // Round 2 has no results yet → not settled
        verify(f1RaceService, never()).enterResults(eq(102L), any());

        assertThat(summary).contains("2 course(s)").contains("manches [1]");
    }

    @Test
    void syncSeason_withoutF1Competition_fails() {
        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> f1SyncService.syncSeason())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No F1 competition");
    }

    @Test
    void syncSeason_withoutConfiguredSeason_fails() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        assertThatThrownBy(() -> f1SyncService.syncSeason())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No jolpica season configured");
    }

    @Test
    void syncSeason_alreadyFinishedRace_isNotResettled() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round1 = race(101L, 1, Race.Status.FINISHED, competition);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceRepository.findByCompetition_IdOrderByRaceDateAsc(9L)).thenReturn(List.of(round1));
        when(jolpicaClient.get("2026.json?limit=100")).thenReturn(CALENDAR_JSON);
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));

        f1SyncService.syncSeason();

        verify(f1RaceService, never()).enterResults(any(), any());
    }

    // ── Forced single-race resync — admin corrections after the fact ──────────

    @Test
    void syncQualifyingForRace_forcesReimportEvenWhenFinished() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round1 = race(101L, 1, Race.Status.FINISHED, competition);

        when(raceRepository.findById(101L)).thenReturn(Optional.of(round1));
        when(jolpicaClient.get("2026/1/qualifying.json?limit=40")).thenReturn(ROUND1_QUALI_JSON);
        stubEntryListUpserts();

        String message = f1SyncService.syncQualifyingForRace(101L);

        verify(qualifyingResultRepository).deleteByRaceId(101L);
        verify(qualifyingResultRepository).saveAll(anyList());
        assertThat(message).contains("Grille de départ réimportée");
    }

    @Test
    void syncQualifyingForRace_unknownRace_throws() {
        when(raceRepository.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> f1SyncService.syncQualifyingForRace(999L))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    @Test
    void syncResultsForRace_forcesReimportAndResettlesEvenWhenFinished() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round1 = race(101L, 1, Race.Status.FINISHED, competition);

        when(raceRepository.findById(101L)).thenReturn(Optional.of(round1));
        when(jolpicaClient.get("2026/1/results.json?limit=40")).thenReturn(ROUND1_RESULTS_JSON);
        when(jolpicaClient.get("2026/1/sprint.json?limit=40")).thenReturn(ROUND1_SPRINT_JSON);
        when(qualifyingResultRepository.findByRaceIdWithDrivers(101L)).thenReturn(List.of());
        stubEntryListUpserts();

        String message = f1SyncService.syncResultsForRace(101L);

        verify(f1RaceService).enterResults(eq(101L), any());
        assertThat(message).contains("Résultats réimportés");
    }

    @Test
    void syncResultsForRace_noJolpicaDataYet_returnsWithoutSettling() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round2 = race(102L, 2, Race.Status.UPCOMING, competition);

        when(raceRepository.findById(102L)).thenReturn(Optional.of(round2));
        when(jolpicaClient.get("2026/2/results.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);

        String message = f1SyncService.syncResultsForRace(102L);

        verify(f1RaceService, never()).enterResults(any(), any());
        assertThat(message).contains("Aucun résultat disponible");
    }

    // ── One-race loan: driver's home constructor must survive a sync ──────────

    /**
     * A driver's home constructor (drivers.constructor_id) must never be silently flipped by
     * a sync, even when jolpica reports them racing for a different team this weekend (a
     * one-off loan). The race result itself still snapshots the team they actually raced
     * for, via the entry's constructorId — that's what feeds the standings.
     */
    @Test
    void fetchAndSettleResults_existingDriverHomeConstructorUnchanged_butEntrySnapshotsRaceConstructor() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).season(2026).build();
        Race round1 = race(101L, 1, Race.Status.FINISHED, competition);

        Constructor racingBulls = Constructor.builder().id(5L).name("Racing Bulls").color("#6692FF").build();
        Constructor redBull = Constructor.builder().id(6L).name("Red Bull").color("#3671C6").build();
        // VER is on file as a Racing Bulls driver (his home team) — but jolpica reports him
        // racing for Red Bull this weekend (a one-off loan for this GP only).
        Driver existingVer = Driver.builder().id(33L).code("VER").name("Max Verstappen").number(33).constructor(racingBulls).build();

        when(raceRepository.findById(101L)).thenReturn(Optional.of(round1));
        when(jolpicaClient.get("2026/1/results.json?limit=40")).thenReturn(ROUND1_RESULTS_JSON);
        when(jolpicaClient.get("2026/1/sprint.json?limit=40")).thenReturn(ROUND1_SPRINT_JSON);
        when(qualifyingResultRepository.findByRaceIdWithDrivers(101L)).thenReturn(List.of());

        when(constructorRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(constructorRepository.findByName("Red Bull")).thenReturn(Optional.of(redBull));
        when(constructorRepository.save(any(Constructor.class))).thenAnswer(inv -> {
            Constructor c = inv.getArgument(0);
            c.setId((long) c.getName().hashCode());
            return c;
        });
        when(driverRepository.findByCode(anyString())).thenReturn(Optional.empty());
        when(driverRepository.findByCode("VER")).thenReturn(Optional.of(existingVer));
        when(driverRepository.findByName(anyString())).thenReturn(Optional.empty());
        long[] driverSeq = {100};
        when(driverRepository.save(any(Driver.class))).thenAnswer(inv -> {
            Driver d = inv.getArgument(0);
            if (d.getId() == null) d.setId(++driverSeq[0]);
            return d;
        });

        f1SyncService.syncResultsForRace(101L);

        ArgumentCaptor<EnterRaceResultsRequest> requestCaptor = ArgumentCaptor.forClass(EnterRaceResultsRequest.class);
        verify(f1RaceService).enterResults(eq(101L), requestCaptor.capture());
        EnterRaceResultsRequest.Entry verEntry = requestCaptor.getValue().getResults().stream()
                .filter(e -> e.getDriverId().equals(33L)).findFirst().orElseThrow();
        assertThat(verEntry.getConstructorId()).isEqualTo(redBull.getId());   // race-specific snapshot: Red Bull

        ArgumentCaptor<Driver> driverCaptor = ArgumentCaptor.forClass(Driver.class);
        verify(driverRepository, atLeastOnce()).save(driverCaptor.capture());
        Driver savedVer = driverCaptor.getAllValues().stream()
                .filter(d -> "VER".equals(d.getCode())).reduce((first, last) -> last).orElseThrow();
        assertThat(savedVer.getConstructor()).isEqualTo(racingBulls);   // home team: untouched by the sync
    }

    /** Entry-list upserts (drivers/constructors) — everything created fresh, no pre-existing match. */
    private void stubEntryListUpserts() {
        when(constructorRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(constructorRepository.save(any(Constructor.class))).thenAnswer(inv -> {
            Constructor c = inv.getArgument(0);
            c.setId((long) c.getName().hashCode());
            return c;
        });
        when(driverRepository.findByCode(anyString())).thenReturn(Optional.empty());
        when(driverRepository.findByName(anyString())).thenReturn(Optional.empty());
        long[] driverSeq = {0};
        when(driverRepository.save(any(Driver.class))).thenAnswer(inv -> {
            Driver d = inv.getArgument(0);
            if (d.getId() == null) d.setId(++driverSeq[0]);
            return d;
        });
    }
}
