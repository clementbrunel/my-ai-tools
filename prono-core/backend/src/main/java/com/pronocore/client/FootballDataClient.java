package com.pronocore.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pronocore.config.FootballDataProperties;
import com.pronocore.util.AppTime;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * football-data.org v4 client — the FOOT sync provider, chosen over api-football because
 * its free plan doesn't cover the current season (only a rolling historical window),
 * which made it useless for live sync on a free budget. Free tier: 10 requests/minute,
 * current season for 12 major competitions (Ligue 1's code is "FL1").
 */
@Slf4j
@Component
public class FootballDataClient {

    public record FdTeam(long id, String name, String shortName, String crestUrl) {}

    public record FdMatch(
            long id,
            LocalDateTime date,
            String homeTeamName,
            String awayTeamName,
            long homeTeamId,
            long awayTeamId,
            String status,
            Integer goalsHome,
            Integer goalsAway,
            Integer matchday
    ) {}

    public record FdStanding(
            int position,
            String teamName,
            String teamShortName,
            String crestUrl,
            int playedGames,
            int won,
            int draw,
            int lost,
            int goalsFor,
            int goalsAgainst,
            int goalDifference,
            int points
    ) {}

    public static final Set<String> FINISHED_STATUSES = Set.of("FINISHED");
    public static final Set<String> LIVE_STATUSES     = Set.of("IN_PLAY", "PAUSED", "LIVE");

    /** Placeholder left in .env.example — never a real key. */
    private static final String PLACEHOLDER_KEY = "your_football_data_api_key_here";

    private static final DateTimeFormatter API_DT   = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter QUERY_DT = DateTimeFormatter.ISO_LOCAL_DATE;

    /** Season-wide fixture/team lists change slowly; the sync window poll never uses this cache. */
    private static final Duration SEASON_TTL = Duration.ofMinutes(10);
    private static final Duration TEAMS_TTL  = Duration.ofHours(12);

    private final FootballDataHttpClient http;
    private final FootballDataProperties props;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private final Map<String, Cached<List<FdMatch>>>    matchesCache   = new HashMap<>();
    private final Map<String, Cached<List<FdTeam>>>     teamsCache     = new HashMap<>();
    private final Map<String, Cached<List<FdStanding>>> standingsCache = new HashMap<>();

    private record Cached<T>(T value, Instant expiresAt) {
        boolean isFresh() { return Instant.now().isBefore(expiresAt); }
    }

    public FootballDataClient(FootballDataHttpClient http, FootballDataProperties props) {
        this.http  = http;
        this.props = props;
    }

    @PostConstruct
    void warnIfDisabled() {
        if (isDisabled()) {
            log.warn("football-data.org: no FOOTBALL_DATA_API_KEY set — automatic football score sync is disabled");
        }
    }

    public boolean isDisabled() {
        String key = props.getApiKey();
        return key == null || key.isBlank() || key.equals(PLACEHOLDER_KEY);
    }

    /** Every match of a competition's season — cached, used for the initial/full calendar import. */
    public synchronized List<FdMatch> getSeasonMatches(String competitionCode, int season) {
        String key = cacheKey(competitionCode, season);
        Cached<List<FdMatch>> cached = matchesCache.get(key);
        if (cached != null && cached.isFresh()) return cached.value();
        List<FdMatch> matches = parseMatches(get("/competitions/" + competitionCode + "/matches?season=" + season));
        matchesCache.put(key, new Cached<>(matches, Instant.now().plus(SEASON_TTL)));
        return matches;
    }

    /**
     * Matches for a competition within a date window — never cached, used by the score-sync
     * poll which needs live data. football-data.org's dateFrom/dateTo are date-only (no time).
     */
    public List<FdMatch> getMatchesInWindow(String competitionCode, LocalDate from, LocalDate to) {
        String path = "/competitions/" + competitionCode + "/matches?dateFrom="
                + QUERY_DT.format(from) + "&dateTo=" + QUERY_DT.format(to);
        return parseMatches(get(path));
    }

    public synchronized List<FdTeam> getTeams(String competitionCode, int season) {
        String key = cacheKey(competitionCode, season);
        Cached<List<FdTeam>> cached = teamsCache.get(key);
        if (cached != null && cached.isFresh()) return cached.value();
        List<FdTeam> teams = parseTeams(get("/competitions/" + competitionCode + "/teams?season=" + season));
        teamsCache.put(key, new Cached<>(teams, Instant.now().plus(TEAMS_TTL)));
        return teams;
    }

    /**
     * Current league table for a competition — live proxy, no local persistence. Cached like
     * the season fixture list (10 min) so a standings page doesn't burn the free tier's
     * 10 requests/minute budget on every page load.
     */
    public synchronized List<FdStanding> getStandings(String competitionCode) {
        Cached<List<FdStanding>> cached = standingsCache.get(competitionCode);
        if (cached != null && cached.isFresh()) return cached.value();
        List<FdStanding> standings = parseStandings(get("/competitions/" + competitionCode + "/standings"));
        standingsCache.put(competitionCode, new Cached<>(standings, Instant.now().plus(SEASON_TTL)));
        return standings;
    }

    public synchronized void invalidateCache() {
        matchesCache.clear();
        teamsCache.clear();
        standingsCache.clear();
    }

    private static String cacheKey(String competitionCode, int season) {
        return competitionCode + ":" + season;
    }

    private String get(String path) {
        return http.get(path);
    }

    private List<FdMatch> parseMatches(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<FdMatch> result = new ArrayList<>();
            for (JsonNode item : root.path("matches")) {
                long id = item.path("id").asLong();
                String dateStr = item.path("utcDate").asText("");
                LocalDateTime date = dateStr.isBlank() ? null : toAppZone(dateStr);
                String status = item.path("status").asText("");
                JsonNode home = item.path("homeTeam");
                JsonNode away = item.path("awayTeam");
                JsonNode fullTime = item.path("score").path("fullTime");
                Integer gh = fullTime.path("home").isNull() ? null : fullTime.path("home").intValue();
                Integer ga = fullTime.path("away").isNull() ? null : fullTime.path("away").intValue();
                Integer matchday = item.path("matchday").isMissingNode() ? null : item.path("matchday").intValue();
                result.add(new FdMatch(id, date,
                        home.path("name").asText(""), away.path("name").asText(""),
                        home.path("id").asLong(), away.path("id").asLong(),
                        status, gh, ga, matchday));
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse football-data.org matches", e);
        }
    }

    /** Converts a UTC instant to the app's local wall time. */
    private static LocalDateTime toAppZone(String isoOffsetDateTime) {
        return OffsetDateTime.parse(isoOffsetDateTime, API_DT)
                .atZoneSameInstant(AppTime.APP_ZONE)
                .toLocalDateTime();
    }

    /** The response also carries HOME/AWAY splits — only the overall "TOTAL" table is used. */
    private List<FdStanding> parseStandings(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<FdStanding> result = new ArrayList<>();
            for (JsonNode group : root.path("standings")) {
                if (!"TOTAL".equals(group.path("type").asText(""))) continue;
                for (JsonNode row : group.path("table")) {
                    JsonNode team = row.path("team");
                    JsonNode crest = team.path("crest");
                    result.add(new FdStanding(
                            row.path("position").asInt(),
                            team.path("name").asText(""),
                            team.path("shortName").asText(""),
                            crest.isMissingNode() || crest.isNull() || crest.asText().isBlank() ? null : crest.asText(),
                            row.path("playedGames").asInt(),
                            row.path("won").asInt(),
                            row.path("draw").asInt(),
                            row.path("lost").asInt(),
                            row.path("goalsFor").asInt(),
                            row.path("goalsAgainst").asInt(),
                            row.path("goalDifference").asInt(),
                            row.path("points").asInt()));
                }
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse football-data.org standings", e);
        }
    }

    private List<FdTeam> parseTeams(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            List<FdTeam> result = new ArrayList<>();
            for (JsonNode team : root.path("teams")) {
                JsonNode crest = team.path("crest");
                result.add(new FdTeam(
                        team.path("id").asLong(),
                        team.path("name").asText(""),
                        team.path("shortName").asText(""),
                        crest.isMissingNode() || crest.isNull() || crest.asText().isBlank() ? null : crest.asText()));
            }
            return result;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse football-data.org teams", e);
        }
    }
}
