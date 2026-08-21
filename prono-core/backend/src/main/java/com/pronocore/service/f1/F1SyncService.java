package com.pronocore.service.f1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.dto.request.EnterRaceResultsRequest;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import com.pronocore.service.F1RaceService;
import com.pronocore.util.AppTime;
import jakarta.persistence.EntityNotFoundException;
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

    private final JolpicaClient jolpicaClient;
    private final CompetitionRepository competitionRepository;
    private final RaceRepository raceRepository;
    private final QualifyingResultRepository qualifyingResultRepository;
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

    /** Full season sync, for the season configured on the (single) F1 competition. Returns a human-readable summary. */
    @Transactional
    public String syncSeason() {
        Competition competition = competitionRepository.findFirstBySportOrderByIdDesc(Sport.F1)
                .orElseThrow(() -> new IllegalStateException("No F1 competition configured"));
        int season = requireSeason(competition);

        int racesUpserted = syncCalendar(season, competition);
        List<Integer> qualifyingRounds = syncQualifying(season, competition);
        List<Integer> settledRounds = syncResults(season, competition);

        String summary = "Calendrier : " + racesUpserted + " course(s) synchronisée(s)"
                + (qualifyingRounds.isEmpty()
                    ? ""
                    : " — grille de départ importée pour les manches " + qualifyingRounds)
                + (settledRounds.isEmpty()
                    ? " — aucun nouveau résultat"
                    : " — résultats importés et paris réglés pour les manches " + settledRounds);
        log.info("🔄 F1 sync {} — {}", season, summary);
        return summary;
    }

    /** The jolpica season year configured on the competition — set once via migration/seed when the season starts. */
    private int requireSeason(Competition competition) {
        Integer season = competition.getSeason();
        if (season == null) {
            throw new IllegalStateException(
                    "No jolpica season configured on competition " + competition.getId());
        }
        return season;
    }

    // ---------------------------------------------------------------
    // Calendar
    // ---------------------------------------------------------------

    private int syncCalendar(int season, Competition competition) {
        JsonNode races = read(season + ".json?limit=100").path("MRData").path("RaceTable").path("Races");
        if (!races.isArray() || races.isEmpty()) {
            throw new IllegalStateException("jolpica returned no calendar for season " + season);
        }

        List<Race> existing = raceRepository.findByCompetition_IdOrderByRaceDateAsc(competition.getId());
        Map<Integer, Race> byRound = new HashMap<>();
        Map<String, Race> byCircuitId = new HashMap<>();
        for (Race r : existing) {
            byRound.put(r.getRound(), r);
            if (r.getExternalCircuitId() != null) byCircuitId.put(r.getExternalCircuitId(), r);
        }

        int count = 0;
        Set<Race> matched = new HashSet<>();
        for (JsonNode raceNode : races) {
            int round = raceNode.path("round").asInt();
            String circuitId = raceNode.path("Circuit").path("circuitId").asText(null);

            // A cancelled/reinstated GP shifts every later round, so `round` alone would match
            // the wrong (or no) existing row — jolpica's circuitId is stable across that shift.
            // circuitId is only trusted for rows a previous sync already tagged with one; a
            // legacy or seeded row still falls back to round for its very first sync.
            Race race = circuitId != null ? byCircuitId.get(circuitId) : null;
            if (race == null) race = byRound.get(round);
            if (race == null) race = Race.builder().round(round).competition(competition).build();

            race.setRound(round);
            race.setExternalCircuitId(circuitId);
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
            matched.add(race);
            count++;
        }

        // Seeded/removed races not present in jolpica's calendar: drop them unless a group already bet on them.
        for (Race race : existing) {
            if (!matched.contains(race) && !betRepository.existsByRaceId(race.getId())) {
                log.info("  🗑 Removing seeded round {} ({}) — not in the official calendar", race.getRound(), race.getName());
                raceRepository.delete(race);
            }
        }
        return count;
    }

    // ---------------------------------------------------------------
    // Qualifying grid — known well before the race, helps players adjust their prono
    // ---------------------------------------------------------------

    /**
     * Imports the starting grid as soon as qualifying is over, independently of the race
     * itself (jolpica exposes {@code /qualifying.json} the same evening). Display only —
     * settlement still runs off {@link #syncResults}. Re-fetches (delete + recreate) on every
     * call while the race hasn't been run yet, so a correction on jolpica's side is picked up.
     * Skips FINISHED races here as a cost-saving default for the full-season sync — grid
     * penalties confirmed after the fact still need {@link #syncQualifyingForRace}.
     */
    private List<Integer> syncQualifying(int season, Competition competition) {
        List<Integer> imported = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (Race race : raceRepository.findByCompetition_IdOrderByRaceDateAsc(competition.getId())) {
            if (race.getStatus() == Race.Status.FINISHED) continue;
            if (race.getQualifyingDate() == null || race.getQualifyingDate().isAfter(now)) continue;
            throttle();
            if (fetchAndStoreQualifyingGrid(season, race)) imported.add(race.getRound());
        }
        return imported;
    }

    /**
     * Forces a re-import of one race's qualifying grid from jolpica, regardless of its
     * FINISHED status — for admin corrections when a grid penalty is confirmed (or jolpica's
     * own data is amended) after {@link #syncQualifying} already skipped it.
     */
    @Transactional
    public String syncQualifyingForRace(Long raceId) {
        Race race = raceRepository.findById(raceId)
                .orElseThrow(() -> new EntityNotFoundException("Race not found: " + raceId));
        int season = requireSeason(race.getCompetition());
        return fetchAndStoreQualifyingGrid(season, race)
                ? "Grille de départ réimportée pour " + race.getName()
                : "Aucune grille de départ disponible sur jolpica pour " + race.getName();
    }

    /** Fetches the grid from jolpica and replaces it (delete + recreate) — false if jolpica has nothing yet. */
    private boolean fetchAndStoreQualifyingGrid(int season, Race race) {
        JsonNode races = read(season + "/" + race.getRound() + "/qualifying.json?limit=40")
                .path("MRData").path("RaceTable").path("Races");
        if (!races.isArray() || races.isEmpty()) return false;

        List<QualifyingResult> grid = new ArrayList<>();
        for (JsonNode q : races.get(0).path("QualifyingResults")) {
            String positionText = q.path("position").asText("");
            if (!positionText.matches("\\d+")) continue;
            Driver driver = upsertDriver(q.path("Driver"), q.path("Constructor"));
            grid.add(QualifyingResult.builder()
                    .race(race)
                    .driver(driver)
                    .position(Integer.parseInt(positionText))
                    .time(bestQualifyingTime(q))
                    .build());
        }
        if (grid.isEmpty()) return false;

        qualifyingResultRepository.deleteByRaceId(race.getId());
        qualifyingResultRepository.saveAll(grid);
        return true;
    }

    /**
     * The grid time shown for a driver: their time in the last knockout session they reached
     * (Q3, else Q2, else Q1) — never a comparison across sessions. A driver eliminated in Q2
     * can post a numerically faster lap than a Q3 finisher (changing weather, track evolution)
     * and still start further back: the grid position (from jolpica's own {@code position}
     * field) already reflects the knockout hierarchy, this only picks which time to display
     * next to it.
     */
    private String bestQualifyingTime(JsonNode qualifyingResult) {
        for (String session : List.of("Q3", "Q2", "Q1")) {
            String time = qualifyingResult.path(session).asText("");
            if (!time.isBlank()) return time;
        }
        return null;
    }

    /** Pole driver code from the stored qualifying grid — populated by {@link #syncQualifying}
     *  earlier in the same sync pass (qualifying always precedes the race). */
    private String polePositionDriverCode(Long raceId) {
        return qualifyingResultRepository.findByRaceIdWithDrivers(raceId).stream()
                .filter(qr -> qr.getPosition() == 1)
                .map(qr -> qr.getDriver().getCode())
                .findFirst()
                .orElse(null);
    }

    // ---------------------------------------------------------------
    // Results
    // ---------------------------------------------------------------

    /**
     * Imports results for every round not yet FINISHED locally and settles them. Skips already
     * FINISHED races as a cost-saving default — a post-race penalty confirmed after the fact
     * still needs {@link #syncResultsForRace}. Returns settled rounds.
     */
    private List<Integer> syncResults(int season, Competition competition) {
        List<Integer> settled = new ArrayList<>();
        for (Race race : raceRepository.findByCompetition_IdOrderByRaceDateAsc(competition.getId())) {
            if (race.getStatus() == Race.Status.FINISHED) continue;
            throttle();
            if (fetchAndSettleResults(season, race)) settled.add(race.getRound());
        }
        return settled;
    }

    /**
     * Forces a re-import of one race's full classification from jolpica and re-settles it,
     * regardless of its FINISHED status — for admin corrections when a penalty is confirmed
     * (or jolpica's own data is amended) after {@link #syncResults} already settled and
     * skipped it. Re-settling recomputes points/gages/forfeits, same as a manual re-entry.
     */
    @Transactional
    public String syncResultsForRace(Long raceId) {
        Race race = raceRepository.findById(raceId)
                .orElseThrow(() -> new EntityNotFoundException("Race not found: " + raceId));
        int season = requireSeason(race.getCompetition());
        return fetchAndSettleResults(season, race)
                ? "Résultats réimportés et paris réglés pour " + race.getName()
                : "Aucun résultat disponible sur jolpica pour " + race.getName();
    }

    /** Fetches the full classification from jolpica and settles it — false if jolpica has nothing yet. */
    private boolean fetchAndSettleResults(int season, Race race) {
        JsonNode raceNode = read(season + "/" + race.getRound() + "/results.json?limit=40")
                .path("MRData").path("RaceTable").path("Races");
        if (!raceNode.isArray() || raceNode.isEmpty()) return false;   // not raced yet
        JsonNode results = raceNode.get(0).path("Results");
        if (!results.isArray() || results.isEmpty()) return false;

        String poleDriverCode = polePositionDriverCode(race.getId());
        Map<String, Integer> sprintPositionByCode = fetchSprintPositions(season, race.getRound());

        List<EnterRaceResultsRequest.Entry> entries = new ArrayList<>();
        for (JsonNode result : results) {
            Driver driver = upsertDriver(result.path("Driver"), result.path("Constructor"));
            // The constructor this driver raced for AT THIS RESULT, from jolpica — may differ
            // from the driver's stored home constructor (see upsertDriver) on a swap weekend.
            Constructor raceConstructor = upsertConstructor(result.path("Constructor").path("name").asText("?"));

            EnterRaceResultsRequest.Entry entry = new EnterRaceResultsRequest.Entry();
            entry.setDriverId(driver.getId());
            entry.setConstructorId(raceConstructor.getId());
            String positionText = result.path("positionText").asText("");
            entry.setPosition(positionText.matches("\\d+") ? Integer.parseInt(positionText) : null);
            String status = result.path("status").asText("");
            entry.setDnf(!status.equals("Finished") && !status.startsWith("+"));
            entry.setFastestLap(result.path("FastestLap").path("rank").asText("").equals("1"));
            entry.setPole(driver.getCode().equals(poleDriverCode));
            entry.setSprintPosition(sprintPositionByCode.get(driver.getCode()));
            String time = result.path("Time").path("time").asText("");
            entry.setTime(!time.isBlank() ? time : null);
            entries.add(entry);
        }

        EnterRaceResultsRequest request = new EnterRaceResultsRequest();
        request.setResults(entries);
        f1RaceService.enterResults(race.getId(), request);
        return true;
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

    /** ~3 calls per round; a small pause keeps bursts under jolpica's rate limit. */
    private void throttle() {
        try {
            Thread.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // ---------------------------------------------------------------
    // Entry list
    // ---------------------------------------------------------------

    private Driver upsertDriver(JsonNode driverNode, JsonNode constructorNode) {
        String code = driverNode.path("code").asText("");
        String name = (driverNode.path("givenName").asText("") + " " + driverNode.path("familyName").asText("")).trim();
        int number = driverNode.path("permanentNumber").asInt(0);
        Constructor constructor = upsertConstructor(constructorNode.path("name").asText("?"));

        // Constructor is only set at creation — an existing driver's home team must not be
        // silently overwritten by a sync (e.g. a one-off single-race loan to another team
        // would otherwise flip their season-long constructor and corrupt past standings the
        // moment the next sync runs). Per-race results record the constructor they actually
        // raced for via race_results.constructor_id (see F1RaceService), not this field.
        Driver driver = driverRepository.findByCode(code)
                .or(() -> driverRepository.findByName(name))
                .orElseGet(() -> Driver.builder().code(code).name(name).number(number).constructor(constructor).build());
        driver.setCode(code);
        driver.setName(name);
        if (number > 0) driver.setNumber(number);
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
            throw new IllegalStateException(
                    "Appel jolpica en échec (" + path + ") : "
                    + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()), e);
        }
    }

    /** Ergast dates are UTC; the app stores Paris local time. */
    private LocalDateTime toParisTime(String date, String time) {
        if (date == null || date.isEmpty()) return null;
        LocalDate d = LocalDate.parse(date);
        if (time == null || time.isEmpty()) return d.atTime(LocalTime.of(15, 0));
        LocalTime t = LocalTime.parse(time.replace("Z", ""));
        return ZonedDateTime.of(d, t, ZoneId.of("UTC")).withZoneSameInstant(AppTime.APP_ZONE).toLocalDateTime();
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
