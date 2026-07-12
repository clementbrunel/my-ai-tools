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

    private static final String ROUND1_QUALI_JSON = """
        {"MRData":{"RaceTable":{"Races":[{"QualifyingResults":[
          {"position":"1","Driver":{"code":"ANT"}},
          {"position":"2","Driver":{"code":"RUS"}}
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
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        Race round1 = race(101L, 1, Race.Status.UPCOMING, competition);
        Race round2 = race(102L, 2, Race.Status.UPCOMING, competition);
        Race round3Seeded = race(103L, 3, Race.Status.UPCOMING, competition);   // not in the real calendar

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceRepository.findByCompetition_IdOrderByRaceDateAsc(9L))
                .thenReturn(List.of(round1, round2, round3Seeded));
        when(jolpicaClient.get("2026.json?limit=100")).thenReturn(CALENDAR_JSON);
        when(jolpicaClient.get("2026/1/results.json?limit=40")).thenReturn(ROUND1_RESULTS_JSON);
        when(jolpicaClient.get("2026/1/qualifying.json?limit=5")).thenReturn(ROUND1_QUALI_JSON);
        when(jolpicaClient.get("2026/2/results.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(jolpicaClient.get("2026/3/results.json?limit=40")).thenReturn(EMPTY_RESULTS_JSON);
        when(betRepository.existsByRaceId(103L)).thenReturn(false);
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));

        // Entry-list upserts: everything is new
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

        String summary = f1SyncService.syncSeason(2026);

        // Calendar: names/dates converted from UTC to Paris time
        assertThat(round1.getName()).isEqualTo("GP d'Australie");
        assertThat(round1.getCountryIso2()).isEqualTo("AU");
        assertThat(round1.getRaceDate()).isEqualTo(LocalDateTime.parse("2026-03-08T05:00"));   // 04:00Z hiver = 05:00 Paris
        assertThat(round1.getQualifyingDate()).isEqualTo(LocalDateTime.parse("2026-03-07T06:00"));
        // Seeded round 3 not in the official calendar and without bets → deleted
        verify(raceRepository).delete(round3Seeded);

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
        // Round 2 has no results yet → not settled
        verify(f1RaceService, never()).enterResults(eq(102L), any());

        assertThat(summary).contains("2 course(s)").contains("manches [1]");
    }

    @Test
    void syncSeason_withoutF1Competition_fails() {
        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> f1SyncService.syncSeason(2026))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No F1 competition");
    }

    @Test
    void syncSeason_alreadyFinishedRace_isNotResettled() {
        Competition competition = Competition.builder().id(9L).name("Formule 1 2026").sport(Sport.F1).build();
        Race round1 = race(101L, 1, Race.Status.FINISHED, competition);

        when(competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)).thenReturn(Optional.of(competition));
        when(raceRepository.findByCompetition_IdOrderByRaceDateAsc(9L)).thenReturn(List.of(round1));
        when(jolpicaClient.get("2026.json?limit=100")).thenReturn(CALENDAR_JSON);
        when(raceRepository.save(any(Race.class))).thenAnswer(inv -> inv.getArgument(0));

        f1SyncService.syncSeason(2026);

        verify(f1RaceService, never()).enterResults(any(), any());
    }
}
