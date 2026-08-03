package com.pronocore.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.config.ApiFootballProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
            Integer goalsAway
    ) {}

    public static final Set<String> FINISHED_STATUSES = Set.of("FT", "AET", "PEN");
    public static final Set<String> LIVE_STATUSES     = Set.of("1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE");

    private static final DateTimeFormatter API_DT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final RestClient restClient;
    private final ApiFootballProperties props;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules();

    private List<ApiFixture> fixturesCache;
    private List<ApiTeam>    teamsCache;
    private List<JsonNode>   countriesCache;

    public ApiFootballClient(ApiFootballProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("x-apisports-key", props.getApiKey())
                .defaultHeader("Accept", "application/json")
                .build();
    }

    public boolean isDisabled() {
        return props.getApiKey() == null || props.getApiKey().isBlank();
    }

    public List<ApiFixture> getAllFixtures() {
        if (fixturesCache != null) return fixturesCache;
        String json = get("/fixtures?league=" + props.getLeagueId() + "&season=" + props.getSeason());
        fixturesCache = parseFixtures(json);
        return fixturesCache;
    }

    public ApiFixture getFixture(long fixtureId) {
        String json = get("/fixtures?id=" + fixtureId);
        List<ApiFixture> list = parseFixtures(json);
        return list.isEmpty() ? null : list.get(0);
    }

    public List<ApiTeam> getTeams() {
        if (teamsCache != null) return teamsCache;
        String json = get("/teams?league=" + props.getLeagueId() + "&season=" + props.getSeason());
        teamsCache = parseTeams(json);
        return teamsCache;
    }

    public List<JsonNode> getCountries() {
        if (countriesCache != null) return countriesCache;
        String json = get("/countries");
        try {
            JsonNode root = objectMapper.readTree(json);
            List<JsonNode> countries = new ArrayList<>();
            root.path("response").forEach(countries::add);
            countriesCache = countries;
            return countriesCache;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse api-football countries", e);
        }
    }

    public void invalidateCache() {
        fixturesCache = null;
        teamsCache    = null;
        countriesCache = null;
    }

    private String get(String path) {
        String uri = path.startsWith("/") ? path : "/" + path;
        int attempts = 0;
        while (true) {
            attempts++;
            try {
                return restClient.get().uri(uri).retrieve().body(String.class);
            } catch (RestClientResponseException e) {
                boolean retryable = e.getStatusCode().is5xxServerError();
                if (!retryable || attempts >= 3) {
                    throw new IllegalStateException(
                            "api-football HTTP " + e.getStatusCode().value() + " on " + path, e);
                }
                log.warn("api-football {} on {} — retry {}/2", e.getStatusCode().value(), path, attempts);
                sleep(1500L * attempts);
            }
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("api-football retry interrupted", ie);
        }
    }

    private List<ApiFixture> parseFixtures(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<ApiFixture> result = new ArrayList<>();
            for (JsonNode item : root.path("response")) {
                long id = item.path("fixture").path("id").asLong();
                String dateStr = item.path("fixture").path("date").asText("");
                LocalDateTime date = dateStr.isBlank() ? null
                        : LocalDateTime.parse(dateStr, API_DT);
                String statusShort = item.path("fixture").path("status").path("short").asText("");
                String home = item.path("teams").path("home").path("name").asText("");
                String away = item.path("teams").path("away").path("name").asText("");
                long homeId = item.path("teams").path("home").path("id").asLong();
                long awayId = item.path("teams").path("away").path("id").asLong();
                JsonNode goals = item.path("goals");
                Integer gh = goals.path("home").isNull() ? null : goals.path("home").intValue();
                Integer ga = goals.path("away").isNull() ? null : goals.path("away").intValue();
                result.add(new ApiFixture(id, date, home, away, homeId, awayId, statusShort, gh, ga));
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse api-football fixtures", e);
        }
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
