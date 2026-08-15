package com.pronocore.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.config.ApiFootballProperties;
import com.pronocore.util.AppTime;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class ApiFootballClient {

    public record ApiTeam(long id, String name, String code, String countryIso2) {}

    public record ApiFixture(
            long fixtureId,
            LocalDateTime date,
            String homeTeamName,
            String awayTeamName,
            long homeTeamId,
            long awayTeamId,
            String statusShort,
            Integer goalsHome,
            Integer goalsAway,
            String round
    ) {}

    public static final Set<String> FINISHED_STATUSES = Set.of("FT", "AET", "PEN");
    public static final Set<String> LIVE_STATUSES     = Set.of("1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE");

    private static final DateTimeFormatter API_DT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    /** api-football caps the multi-id fixtures endpoint at 20 ids per call. */
    private static final int MAX_IDS_PER_CALL = 20;

    /** Fixtures move (kickoff changes, added rounds), so the season list is refreshed regularly. */
    private static final Duration FIXTURES_TTL  = Duration.ofMinutes(10);
    /** Team and country reference data is effectively static over a season. */
    private static final Duration REFERENCE_TTL = Duration.ofHours(12);

    private final ApiFootballHttpClient http;
    private final ApiFootballProperties props;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    /**
     * Guarded by {@code this} — read by request threads and the sync scheduler alike.
     * Keyed per (leagueId, season) so several competitions (World Cup, Ligue 1...) can
     * be queried and cached independently.
     */
    private final Map<String, Cached<List<ApiFixture>>> fixturesCache = new HashMap<>();
    private final Map<String, Cached<List<ApiTeam>>>    teamsCache    = new HashMap<>();
    private Cached<List<JsonNode>> countriesCache;

    private record Cached<T>(T value, Instant expiresAt) {
        boolean isFresh() { return Instant.now().isBefore(expiresAt); }
    }

    public ApiFootballClient(ApiFootballHttpClient http, ApiFootballProperties props) {
        this.http  = http;
        this.props = props;
    }

    @PostConstruct
    void warnIfDisabled() {
        if (isDisabled()) {
            log.warn("api-football: no API_FOOTBALL_KEY set — automatic football score sync is disabled");
        }
    }

    /** Placeholder left in .env.example — never a real key. */
    private static final String PLACEHOLDER_KEY = "re_your_api_key_here";

    public boolean isDisabled() {
        String key = props.getApiKey();
        return key == null || key.isBlank() || key.equals(PLACEHOLDER_KEY);
    }

    public synchronized List<ApiFixture> getAllFixtures(int leagueId, int season) {
        String key = cacheKey(leagueId, season);
        Cached<List<ApiFixture>> cached = fixturesCache.get(key);
        if (cached != null && cached.isFresh()) return cached.value();
        String json = get("/fixtures?league=" + leagueId + "&season=" + season);
        List<ApiFixture> fixtures = parseFixtures(json);
        fixturesCache.put(key, new Cached<>(fixtures, Instant.now().plus(FIXTURES_TTL)));
        return fixtures;
    }

    /**
     * Fetches several fixtures in as few calls as possible. The sync scheduler polls
     * every 5 minutes, so one call per match would burn the daily quota within hours.
     */
    public List<ApiFixture> getFixtures(Collection<Long> fixtureIds) {
        List<Long> ids = new ArrayList<>(new LinkedHashSet<>(fixtureIds));
        if (ids.isEmpty()) return List.of();

        List<ApiFixture> result = new ArrayList<>();
        for (int from = 0; from < ids.size(); from += MAX_IDS_PER_CALL) {
            List<Long> chunk = ids.subList(from, Math.min(from + MAX_IDS_PER_CALL, ids.size()));
            String joined = chunk.stream().map(String::valueOf).reduce((a, b) -> a + "-" + b).orElseThrow();
            result.addAll(parseFixtures(get("/fixtures?ids=" + joined)));
        }
        return result;
    }

    public synchronized List<ApiTeam> getTeams(int leagueId, int season) {
        String key = cacheKey(leagueId, season);
        Cached<List<ApiTeam>> cached = teamsCache.get(key);
        if (cached != null && cached.isFresh()) return cached.value();
        String json = get("/teams?league=" + leagueId + "&season=" + season);
        List<ApiTeam> teams = parseTeams(json);
        teamsCache.put(key, new Cached<>(teams, Instant.now().plus(REFERENCE_TTL)));
        return teams;
    }

    public synchronized List<JsonNode> getCountries() {
        if (countriesCache != null && countriesCache.isFresh()) return countriesCache.value();
        String json = get("/countries");
        try {
            JsonNode root = objectMapper.readTree(json);
            List<JsonNode> countries = new ArrayList<>();
            root.path("response").forEach(countries::add);
            countriesCache = new Cached<>(countries, Instant.now().plus(REFERENCE_TTL));
            return countries;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse api-football countries", e);
        }
    }

    public synchronized void invalidateCache() {
        fixturesCache.clear();
        teamsCache.clear();
        countriesCache = null;
    }

    private static String cacheKey(int leagueId, int season) {
        return leagueId + ":" + season;
    }

    private String get(String path) {
        return http.get(path);
    }

    private List<ApiFixture> parseFixtures(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<ApiFixture> result = new ArrayList<>();
            for (JsonNode item : root.path("response")) {
                long id = item.path("fixture").path("id").asLong();
                String dateStr = item.path("fixture").path("date").asText("");
                LocalDateTime date = dateStr.isBlank() ? null : toAppZone(dateStr);
                String statusShort = item.path("fixture").path("status").path("short").asText("");
                String home = item.path("teams").path("home").path("name").asText("");
                String away = item.path("teams").path("away").path("name").asText("");
                long homeId = item.path("teams").path("home").path("id").asLong();
                long awayId = item.path("teams").path("away").path("id").asLong();
                String round = item.path("league").path("round").asText("");
                JsonNode goals = item.path("goals");
                Integer gh = goals.path("home").isNull() ? null : goals.path("home").intValue();
                Integer ga = goals.path("away").isNull() ? null : goals.path("away").intValue();
                result.add(new ApiFixture(id, date, home, away, homeId, awayId, statusShort, gh, ga, round));
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse api-football fixtures", e);
        }
    }

    /** Converts an offset-qualified api-football instant to the app's local wall time. */
    private static LocalDateTime toAppZone(String isoOffsetDateTime) {
        return OffsetDateTime.parse(isoOffsetDateTime, API_DT)
                .atZoneSameInstant(AppTime.APP_ZONE)
                .toLocalDateTime();
    }

    private List<ApiTeam> parseTeams(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<ApiTeam> result = new ArrayList<>();
            for (JsonNode item : root.path("response")) {
                JsonNode t = item.path("team");
                result.add(new ApiTeam(
                        t.path("id").asLong(),
                        t.path("name").asText(""),
                        t.path("code").asText(""),
                        t.path("country").asText("")));
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse api-football teams", e);
        }
    }
}
