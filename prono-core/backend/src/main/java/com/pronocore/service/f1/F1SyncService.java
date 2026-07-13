package com.pronocore.service.f1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.F1RaceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Imports the season from the jolpica-f1 API (Ergast-compatible):
 * calendar, entry list (drivers + constructors) and race results.
 *
 * Each finished race is settled through the same path as a manual admin
 * entry ({@link F1RaceService#enterResults}), so bets, points and the
 * daily gage behave identically whether results are typed or imported.
 *
 * Sprint classifications are imported too (no betting on sprints) so the
 * championship standings include FIA sprint points.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class F1SyncService {

    /** App times are stored as Paris local time (same convention as football matches). */
    private static final ZoneId APP_ZONE = ZoneId.of("Europe/Paris");

    private final JolpicaClient jolpicaClient;
    private final CompetitionRepository competitionRepository;
    private final RaceRepository raceRepository;
    private final DriverRepository driverRepository;
    private final ConstructorRepository constructorRepository;
    private final BetRepository betRepository;
    private final F1RaceService f1RaceService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Fallback colors for constructors created by the sync. */
    private static final Map<String, String> CONSTRUCTOR_COLORS = Map.ofEntries(
            Map.entry("McLaren", "#FF8000"),
            Map.entry("Ferrari", "#E8002D"),
            Map.entry("Red Bull", "#3671C6"),
            Map.entry("Mercedes", "#27F4D2"),
            Map.entry("Aston Martin", "#229971"),
            Map.entry("Alpine F1 Team", "#0093CC"),
            Map.entry("Alpine", "#0093CC"),
            Map.entry("Haas F1 Team", "#B6BABD"),
            Map.entry("Haas", "#B6BABD"),
            Map.entry("RB F1 Team", "#6692FF"),
            Map.entry("Racing Bulls", "#6692FF"),
            Map.entry("Williams", "#64C4FF"),
            Map.entry("Audi", "#BB0A30"),
            Map.entry("Sauber", "#BB0A30"),
            Map.entry("Cadillac", "#D4AF37"));

    private static final Map<String, String> COUNTRY_ISO2 = Map.ofEntries(
            Map.entry("Australia", "AU"), Map.entry("China", "CN"), Map.entry("Japan", "JP"),
            Map.entry("Bahrain", "BH"), Map.entry("Saudi Arabia", "SA"), Map.entry("USA", "US"),
            Map.entry("United States", "US"), Map.entry("Canada", "CA"), Map.entry("Monaco", "MC"),
            Map.entry("Spain", "ES"), Map.entry("Austria", "AT"), Map.entry("UK", "GB"),
            Map.entry("United Kingdom", "GB"), Map.entry("Great Britain", "GB"), Map.entry("Belgium", "BE"),
            Map.entry("Hungary", "HU"), Map.entry("Netherlands", "NL"), Map.entry("Italy", "IT"),
            Map.entry("Azerbaijan", "AZ"), Map.entry("Singapore", "SG"), Map.entry("Mexico", "MX"),
            Map.entry("Brazil", "BR"), Map.entry("Qatar", "QA"), Map.entry("UAE", "AE"),
            Map.entry("United Arab Emirates", "AE"));

    /**
     * Full season sync. Returns a human-readable summary of what was done.
     *
     * @param season e.g. 2026 — matched to the (single) F1 competition.
     */
    @Transactional
    public String syncSeason(int season) {
        Competition competition = competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)
                .orElseThrow(() -> new IllegalStateException("No F1 competition configured"));

        int racesUpserted = syncCalendar(season, competition);
        List<Integer> settledRounds = syncResults(season, competition);

        String summary = "Calendrier : " + racesUpserted + " course(s) synchronisée(s)"
                + (settledRounds.isEmpty()
                    ? " — aucun nouveau résultat"
                    : " — résultats importés et paris réglés pour les manches " + settledRounds);
        log.info("🔄 F1 sync {} — {}", season, summary);
        return summary;
    }

    // ---------------------------------------------------------------
    // Calendar
    // ---------------------------------------------------------------

    private int syncCalendar(int season, Competition competition) {
        JsonNode races = read(season + ".json?limit=100").path("MRData").path("RaceTable").path("Races");
        if (!races.isArray() || races.isEmpty()) {
            throw new IllegalStateException("jolpica returned no calendar for season " + season);
        }

        Map<Integer, Race> byRound = new HashMap<>();
        raceRepository.findByCompetition_IdOrderByRaceDateAsc(competition.getId())
                .forEach(r -> byRound.put(r.getRound(), r));

        int count = 0;
        int maxRound = 0;
        for (JsonNode raceNode : races) {
            int round = raceNode.path("round").asInt();
            maxRound = Math.max(maxRound, round);
            Race race = byRound.getOrDefault(round, Race.builder()
                    .round(round)
                    .competition(competition)
                    .build());

            race.setName(frenchRaceName(raceNode.path("raceName").asText()));
            race.setCircuit(raceNode.path("Circuit").path("circuitName").asText(null));
            String country = raceNode.path("Circuit").path("Location").path("country").asText("");
            race.setCountryIso2(COUNTRY_ISO2.getOrDefault(country, race.getCountryIso2()));

            LocalDateTime raceDate = toParisTime(raceNode.path("date").asText(null), raceNode.path("time").asText(null));
            if (raceDate != null) race.setRaceDate(raceDate);
            JsonNode quali = raceNode.path("Qualifying");
            LocalDateTime qualiDate = toParisTime(quali.path("date").asText(null), quali.path("time").asText(null));
            race.setQualifyingDate(qualiDate != null ? qualiDate
                    : (race.getQualifyingDate() != null ? race.getQualifyingDate() : race.getRaceDate().minusDays(1)));
            JsonNode sprint = raceNode.path("Sprint");
            race.setSprintDate(toParisTime(sprint.path("date").asText(null), sprint.path("time").asText(null)));

            raceRepository.save(race);
            count++;
        }

        // Seeded rounds beyond the real calendar: drop them unless a group already bet on them.
        for (Race race : byRound.values()) {
            if (race.getRound() > maxRound && !betRepository.existsByRaceId(race.getId())) {
                log.info("  🗑 Removing seeded round {} ({}) — not in the official calendar", race.getRound(), race.getName());
                raceRepository.delete(race);
            }
        }
        return count;
    }

    // ---------------------------------------------------------------
    // Results
    // ---------------------------------------------------------------

    /** Imports results for every finished round not yet FINISHED locally. Returns settled rounds. */
    private List<Integer> syncResults(int season, Competition competition) {
        List<Integer> settled = new ArrayList<>();
        List<Race> localRaces = raceRepository.findByCompetition_IdOrderByRaceDateAsc(competition.getId());

        for (Race race : localRaces) {
            if (race.getStatus() == Race.Status.FINISHED) continue;

            JsonNode raceNode = read(season + "/" + race.getRound() + "/results.json?limit=40")
                    .path("MRData").path("RaceTable").path("Races");
            if (!raceNode.isArray() || raceNode.isEmpty()) continue;   // not raced yet
            JsonNode results = raceNode.get(0).path("Results");
            if (!results.isArray() || results.isEmpty()) continue;

            String poleDriverCode = fetchPoleDriverCode(season, race.getRound());
            Map<String, Integer> sprintPositionByCode = fetchSprintPositions(season, race.getRound());

            List<EnterRaceResultsRequest.Entry> entries = new ArrayList<>();
            for (JsonNode result : results) {
                Driver driver = upsertDriver(result.path("Driver"), result.path("Constructor"));

                EnterRaceResultsRequest.Entry entry = new EnterRaceResultsRequest.Entry();
                entry.setDriverId(driver.getId());
                String positionText = result.path("positionText").asText("");
                entry.setPosition(positionText.matches("\\d+") ? Integer.parseInt(positionText) : null);
                String status = result.path("status").asText("");
                entry.setDnf(!status.equals("Finished") && !status.startsWith("+"));
                entry.setFastestLap(result.path("FastestLap").path("rank").asText("").equals("1"));
                entry.setPole(driver.getCode().equals(poleDriverCode));
                entry.setSprintPosition(sprintPositionByCode.get(driver.getCode()));
                entries.add(entry);
            }

            EnterRaceResultsRequest request = new EnterRaceResultsRequest();
            request.setResults(entries);
            f1RaceService.enterResults(race.getId(), request);
            settled.add(race.getRound());
        }
        return settled;
    }

    /** Sprint classification by driver code — empty map when the weekend has no sprint. */
    private Map<String, Integer> fetchSprintPositions(int season, int round) {
        JsonNode races = read(season + "/" + round + "/sprint.json?limit=40")
                .path("MRData").path("RaceTable").path("Races");
        if (!races.isArray() || races.isEmpty()) return Map.of();
        Map<String, Integer> positions = new HashMap<>();
        for (JsonNode result : races.get(0).path("SprintResults")) {
            String positionText = result.path("positionText").asText("");
            if (positionText.matches("\\d+")) {
                positions.put(result.path("Driver").path("code").asText(""), Integer.parseInt(positionText));
            }
        }
        return positions;
    }

    private String fetchPoleDriverCode(int season, int round) {
        JsonNode races = read(season + "/" + round + "/qualifying.json?limit=5")
                .path("MRData").path("RaceTable").path("Races");
        if (!races.isArray() || races.isEmpty()) return null;
        for (JsonNode q : races.get(0).path("QualifyingResults")) {
            if (q.path("position").asText("").equals("1")) {
                return q.path("Driver").path("code").asText(null);
            }
        }
        return null;
    }

    // ---------------------------------------------------------------
    // Entry list
    // ---------------------------------------------------------------

    private Driver upsertDriver(JsonNode driverNode, JsonNode constructorNode) {
        String code = driverNode.path("code").asText("");
        String name = (driverNode.path("givenName").asText("") + " " + driverNode.path("familyName").asText("")).trim();
        int number = driverNode.path("permanentNumber").asInt(0);
        Constructor constructor = upsertConstructor(constructorNode.path("name").asText("?"));

        Driver driver = driverRepository.findByCode(code)
                .or(() -> driverRepository.findByName(name))
                .orElseGet(() -> Driver.builder().code(code).name(name).number(number).constructor(constructor).build());
        driver.setCode(code);
        driver.setName(name);
        if (number > 0) driver.setNumber(number);
        driver.setConstructor(constructor);
        driver.setActive(true);
        return driverRepository.save(driver);
    }

    private Constructor upsertConstructor(String name) {
        String normalized = normalizeConstructorName(name);
        return constructorRepository.findByName(normalized)
                .orElseGet(() -> constructorRepository.save(Constructor.builder()
                        .name(normalized)
                        .color(CONSTRUCTOR_COLORS.getOrDefault(name,
                                CONSTRUCTOR_COLORS.getOrDefault(normalized, "#888888")))
                        .build()));
    }

    /** Aligns Ergast constructor names with the seeded French-friendly ones. */
    private String normalizeConstructorName(String name) {
        return switch (name) {
            case "Alpine F1 Team" -> "Alpine";
            case "Haas F1 Team" -> "Haas";
            case "RB F1 Team" -> "Racing Bulls";
            case "Sauber" -> "Audi";
            default -> name;
        };
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private JsonNode read(String path) {
        try {
            return objectMapper.readTree(jolpicaClient.get(path));
        } catch (Exception e) {
            throw new IllegalStateException("jolpica call failed: " + path, e);
        }
    }

    /** Ergast dates are UTC; the app stores Paris local time. */
    private LocalDateTime toParisTime(String date, String time) {
        if (date == null || date.isEmpty()) return null;
        LocalDate d = LocalDate.parse(date);
        if (time == null || time.isEmpty()) return d.atTime(LocalTime.of(15, 0));
        LocalTime t = LocalTime.parse(time.replace("Z", ""));
        return ZonedDateTime.of(d, t, ZoneId.of("UTC")).withZoneSameInstant(APP_ZONE).toLocalDateTime();
    }

    /** "Australian Grand Prix" → "GP d'Australie" for the common ones, passthrough otherwise. */
    private String frenchRaceName(String englishName) {
        Map<String, String> names = Map.ofEntries(
                Map.entry("Australian Grand Prix", "GP d'Australie"),
                Map.entry("Chinese Grand Prix", "GP de Chine"),
                Map.entry("Japanese Grand Prix", "GP du Japon"),
                Map.entry("Bahrain Grand Prix", "GP de Bahreïn"),
                Map.entry("Saudi Arabian Grand Prix", "GP d'Arabie saoudite"),
                Map.entry("Miami Grand Prix", "GP de Miami"),
                Map.entry("Emilia Romagna Grand Prix", "GP d'Émilie-Romagne"),
                Map.entry("Monaco Grand Prix", "GP de Monaco"),
                Map.entry("Spanish Grand Prix", "GP d'Espagne"),
                Map.entry("Canadian Grand Prix", "GP du Canada"),
                Map.entry("Austrian Grand Prix", "GP d'Autriche"),
                Map.entry("British Grand Prix", "GP de Grande-Bretagne"),
                Map.entry("Belgian Grand Prix", "GP de Belgique"),
                Map.entry("Hungarian Grand Prix", "GP de Hongrie"),
                Map.entry("Dutch Grand Prix", "GP des Pays-Bas"),
                Map.entry("Italian Grand Prix", "GP d'Italie"),
                Map.entry("Madrid Grand Prix", "GP de Madrid"),
                Map.entry("Azerbaijan Grand Prix", "GP d'Azerbaïdjan"),
                Map.entry("Singapore Grand Prix", "GP de Singapour"),
                Map.entry("United States Grand Prix", "GP des États-Unis"),
                Map.entry("Mexico City Grand Prix", "GP du Mexique"),
                Map.entry("Mexican Grand Prix", "GP du Mexique"),
                Map.entry("São Paulo Grand Prix", "GP du Brésil"),
                Map.entry("Brazilian Grand Prix", "GP du Brésil"),
                Map.entry("Las Vegas Grand Prix", "GP de Las Vegas"),
                Map.entry("Qatar Grand Prix", "GP du Qatar"),
                Map.entry("Abu Dhabi Grand Prix", "GP d'Abou Dabi"));
        return names.getOrDefault(englishName, englishName);
    }
}
