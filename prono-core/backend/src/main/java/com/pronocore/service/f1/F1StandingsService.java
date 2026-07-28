package com.pronocore.service.f1;

import com.pronocore.dto.response.DriverResponse;
import com.pronocore.dto.response.F1StandingHistoryResponse;
import com.pronocore.dto.response.F1StandingResponse;
import com.pronocore.entity.Constructor;
import com.pronocore.entity.Driver;
import com.pronocore.entity.Race;
import com.pronocore.entity.RaceResult;
import com.pronocore.entity.Sport;
import com.pronocore.repository.CompetitionRepository;
import com.pronocore.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Driver/constructor championship standings, computed from race results — FIA points scale. */
@Service
@RequiredArgsConstructor
public class F1StandingsService {

    private final RaceResultRepository raceResultRepository;
    private final CompetitionRepository competitionRepository;

    /** FIA points scales — drive the driver/constructor standings. */
    private static final int[] FIA_POINTS        = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};
    private static final int[] FIA_SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};

    private static final int STANDINGS_HISTORY_TOP_N = 10;

    public static int fiaPoints(Integer position) {
        if (position == null || position < 1 || position > FIA_POINTS.length) return 0;
        return FIA_POINTS[position - 1];
    }

    public static int fiaSprintPoints(Integer sprintPosition) {
        if (sprintPosition == null || sprintPosition < 1 || sprintPosition > FIA_SPRINT_POINTS.length) return 0;
        return FIA_SPRINT_POINTS[sprintPosition - 1];
    }

    /** Race + sprint points scored by a single result — the one formula every standings computation shares. */
    private static int pointsFor(RaceResult rr) {
        return fiaPoints(rr.getPosition()) + fiaSprintPoints(rr.getSprintPosition());
    }

    @Transactional(readOnly = true)
    public List<F1StandingResponse> getDriverStandings() {
        return computeDriverStandings(findSeasonResults());
    }

    @Transactional(readOnly = true)
    public List<F1StandingResponse> getConstructorStandings() {
        return computeConstructorStandings(findSeasonResults());
    }

    private List<F1StandingResponse> computeDriverStandings(List<RaceResult> results) {
        Map<Long, F1StandingResponse> byDriver = new LinkedHashMap<>();
        Map<Long, Integer> points = new HashMap<>();
        Map<Long, Integer> wins = new HashMap<>();
        Map<Long, Integer> podiums = new HashMap<>();

        for (RaceResult rr : results) {
            Long driverId = rr.getDriver().getId();
            byDriver.computeIfAbsent(driverId, id -> F1StandingResponse.builder()
                    .driver(toDriverResponse(rr.getDriver()))
                    .constructorId(rr.getDriver().getConstructor().getId())
                    .constructorName(rr.getDriver().getConstructor().getName())
                    .constructorColor(rr.getDriver().getConstructor().getColor())
                    .build());
            points.merge(driverId, pointsFor(rr), Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() == 1) wins.merge(driverId, 1, Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() <= 3) podiums.merge(driverId, 1, Integer::sum);
        }
        return rank(byDriver, points, wins, podiums);
    }

    private List<F1StandingResponse> computeConstructorStandings(List<RaceResult> results) {
        Map<Long, F1StandingResponse> byConstructor = new LinkedHashMap<>();
        Map<Long, Integer> points = new HashMap<>();
        Map<Long, Integer> wins = new HashMap<>();
        Map<Long, Integer> podiums = new HashMap<>();

        for (RaceResult rr : results) {
            Constructor constructor = rr.getDriver().getConstructor();
            Long constructorId = constructor.getId();
            byConstructor.computeIfAbsent(constructorId, id -> F1StandingResponse.builder()
                    .constructorId(constructorId)
                    .constructorName(constructor.getName())
                    .constructorColor(constructor.getColor())
                    .build());
            points.merge(constructorId, pointsFor(rr), Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() == 1) wins.merge(constructorId, 1, Integer::sum);
            if (rr.getPosition() != null && rr.getPosition() <= 3) podiums.merge(constructorId, 1, Integer::sum);
        }
        return rank(byConstructor, points, wins, podiums);
    }

    @Transactional(readOnly = true)
    public F1StandingHistoryResponse getDriverStandingsHistory() {
        List<RaceResult> results = findSeasonResults();
        return buildStandingsHistory(computeDriverStandings(results), results, rr -> rr.getDriver().getId());
    }

    @Transactional(readOnly = true)
    public F1StandingHistoryResponse getConstructorStandingsHistory() {
        List<RaceResult> results = findSeasonResults();
        return buildStandingsHistory(computeConstructorStandings(results), results, rr -> rr.getDriver().getConstructor().getId());
    }

    /** Walks the season's race results in round order to build a cumulative points series per entity. */
    private F1StandingHistoryResponse buildStandingsHistory(List<F1StandingResponse> standings,
                                                             List<RaceResult> results,
                                                             Function<RaceResult, Long> entityIdOf) {
        Map<Long, Race> racesById = new LinkedHashMap<>();
        for (RaceResult rr : results) {
            racesById.putIfAbsent(rr.getRace().getId(), rr.getRace());
        }
        List<Race> races = racesById.values().stream()
                .sorted(Comparator.comparingInt(Race::getRound))
                .toList();

        Map<Long, Map<Long, Integer>> pointsByRaceThenEntity = new HashMap<>();
        for (RaceResult rr : results) {
            long raceId = rr.getRace().getId();
            long entityId = entityIdOf.apply(rr);
            pointsByRaceThenEntity.computeIfAbsent(raceId, id -> new HashMap<>())
                    .merge(entityId, pointsFor(rr), Integer::sum);
        }

        List<F1StandingHistoryResponse.Series> series = new ArrayList<>();
        for (F1StandingResponse row : standings.stream().limit(STANDINGS_HISTORY_TOP_N).toList()) {
            Long entityId = row.getDriver() != null ? row.getDriver().getId() : row.getConstructorId();
            String label = row.getDriver() != null ? row.getDriver().getName() : row.getConstructorName();
            String code = row.getDriver() != null ? row.getDriver().getCode() : null;
            int running = 0;
            List<Integer> cumulative = new ArrayList<>(races.size());
            for (Race race : races) {
                running += pointsByRaceThenEntity
                        .getOrDefault(race.getId(), Map.of())
                        .getOrDefault(entityId, 0);
                cumulative.add(running);
            }
            series.add(F1StandingHistoryResponse.Series.builder()
                    .label(label)
                    .code(code)
                    .color(row.getConstructorColor())
                    .points(cumulative)
                    .build());
        }

        List<F1StandingHistoryResponse.RacePoint> racePoints = races.stream()
                .map(r -> new F1StandingHistoryResponse.RacePoint(r.getRound(), r.getName()))
                .toList();

        return F1StandingHistoryResponse.builder().races(racePoints).series(series).build();
    }

    private List<RaceResult> findSeasonResults() {
        return competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)
                .map(c -> raceResultRepository.findByCompetitionIdWithDrivers(c.getId()))
                .orElse(List.of());
    }

    private List<F1StandingResponse> rank(Map<Long, F1StandingResponse> entries,
                                          Map<Long, Integer> points,
                                          Map<Long, Integer> wins,
                                          Map<Long, Integer> podiums) {
        List<Map.Entry<Long, F1StandingResponse>> sorted = new ArrayList<>(entries.entrySet());
        sorted.sort(Comparator
                .comparingInt((Map.Entry<Long, F1StandingResponse> e) -> -points.getOrDefault(e.getKey(), 0))
                .thenComparingInt(e -> -wins.getOrDefault(e.getKey(), 0)));

        List<F1StandingResponse> standings = new ArrayList<>();
        int rank = 1;
        for (Map.Entry<Long, F1StandingResponse> entry : sorted) {
            F1StandingResponse row = entry.getValue();
            row.setRank(rank++);
            row.setPoints(points.getOrDefault(entry.getKey(), 0));
            row.setWins(wins.getOrDefault(entry.getKey(), 0));
            row.setPodiums(podiums.getOrDefault(entry.getKey(), 0));
            standings.add(row);
        }
        return standings;
    }

    private DriverResponse toDriverResponse(Driver driver) {
        return DriverResponse.builder()
                .id(driver.getId())
                .name(driver.getName())
                .code(driver.getCode())
                .number(driver.getNumber())
                .constructorId(driver.getConstructor().getId())
                .constructorName(driver.getConstructor().getName())
                .constructorColor(driver.getConstructor().getColor())
                .build();
    }
}
