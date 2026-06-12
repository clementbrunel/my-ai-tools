package com.pronocore.client;

import com.pronocore.config.ApiFootballProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Thin wrapper around the api-sports.io / api-football.com v3 REST API.
 *
 * Rate limit: 100 req/day on the free tier.
 * Strategy:
 *   - Teams + countries: fetched once per JVM lifecycle (never change mid-season)
 *   - All WC fixtures:   cached once per UTC day
 *   - Single fixture:    always live (called only during active match windows)
 */
@Slf4j
@Component
public class ApiFootballClient {

    public static final Set<String> FINISHED_STATUSES = Set.of("FT", "AET", "PEN", "AWD", "WO");
    public static final Set<String> LIVE_STATUSES     = Set.of("1H", "HT", "2H", "ET", "BT", "P");

    // ----------------------------------------------------------------
    // DTOs
    // ----------------------------------------------------------------

    /** One fixture from the API. Team IDs enable reliable home/away mapping. */
    public record ApiFixture(
            long           fixtureId,
            long           homeTeamId,
            String         homeTeam,
            long           awayTeamId,
            String         awayTeam,
            OffsetDateTime date,
            String         statusShort,
            Integer        homeGoals,
            Integer        awayGoals
    ) {}

    /** A national team entry from GET /teams. */
    public record ApiTeam(long teamId, String name, String country) {}

    // ----------------------------------------------------------------
    // Fields
    // ----------------------------------------------------------------

    private final RestClient            restClient;
    private final ApiFootballProperties props;

    private List<ApiFixture>        cachedFixtures  = null;
    private LocalDate               cacheDate       = null;
    private List<ApiTeam>           cachedTeams     = null;
    private Map<String, String>     cachedCountries = null; // EN country name → lowercase ISO2

    public ApiFootballClient(@Qualifier("apiFootballRestClient") RestClient restClient,
                             ApiFootballProperties props) {
        this.restClient = restClient;
        this.props      = props;
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    public boolean isDisabled() {
        return props.getApiKey() == null || props.getApiKey().isBlank();
    }

    /** All WC fixtures — cached once per UTC day. */
    public List<ApiFixture> getAllFixtures() {
        if (isDisabled()) return List.of();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (cachedFixtures == null || !today.equals(cacheDate)) {
            cachedFixtures = fetchFixtures(null);
            cacheDate = today;
            log.info("api-football: cached {} fixtures for WC {}", cachedFixtures.size(), props.getSeason());
        }
        return cachedFixtures;
    }

    /** Single fixture by ID — always live (no cache). */
    public ApiFixture getFixture(long fixtureId) {
        if (isDisabled()) return null;
        List<ApiFixture> fixtures = fetchFixtures(fixtureId);
        return fixtures.isEmpty() ? null : fixtures.get(0);
    }

    /** All teams in the competition — cached for the JVM lifetime. */
    public List<ApiTeam> getTeams() {
        if (isDisabled()) return List.of();
        if (cachedTeams == null) {
            cachedTeams = fetchTeams();
            log.info("api-football: cached {} teams for WC {}", cachedTeams.size(), props.getSeason());
        }
        return cachedTeams;
    }

    /**
     * All countries — cached for the JVM lifetime.
     * Returns Map&lt;English country name, lowercase ISO2 code&gt;.
     */
    public Map<String, String> getCountries() {
        if (isDisabled()) return Map.of();
        if (cachedCountries == null) {
            cachedCountries = fetchCountries();
            log.info("api-football: cached {} countries", cachedCountries.size());
        }
        return cachedCountries;
    }

    public void invalidateCache() {
        cachedFixtures  = null;
        cacheDate       = null;
        // Teams and countries are immutable for the season — no reset needed
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private List<ApiFixture> fetchFixtures(Long fixtureId) {
        try {
            String uri = fixtureId != null
                    ? "/fixtures?id=" + fixtureId
                    : "/fixtures?league=" + props.getLeagueId() + "&season=" + props.getSeason();

            Map<?, ?> body = restClient.get().uri(uri).retrieve().body(Map.class);
            if (body == null) return List.of();

            List<?> response = (List<?>) body.get("response");
            if (response == null) return List.of();

            List<ApiFixture> result = new ArrayList<>();
            for (Object item : response) {
                Map<?, ?> entry    = (Map<?, ?>) item;
                Map<?, ?> fixture  = (Map<?, ?>) entry.get("fixture");
                Map<?, ?> teams    = (Map<?, ?>) entry.get("teams");
                Map<?, ?> goals    = (Map<?, ?>) entry.get("goals");
                Map<?, ?> status   = (Map<?, ?>) fixture.get("status");
                Map<?, ?> homeMap  = (Map<?, ?>) teams.get("home");
                Map<?, ?> awayMap  = (Map<?, ?>) teams.get("away");

                result.add(new ApiFixture(
                        ((Number) fixture.get("id")).longValue(),
                        ((Number) homeMap.get("id")).longValue(),
                        (String) homeMap.get("name"),
                        ((Number) awayMap.get("id")).longValue(),
                        (String) awayMap.get("name"),
                        OffsetDateTime.parse((String) fixture.get("date")),
                        (String) status.get("short"),
                        goals != null && goals.get("home") != null ? ((Number) goals.get("home")).intValue() : null,
                        goals != null && goals.get("away") != null ? ((Number) goals.get("away")).intValue() : null
                ));
            }
            return result;
        } catch (Exception e) {
            log.warn("api-football: fixtures fetch failed (id={}): {}", fixtureId, e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<ApiTeam> fetchTeams() {
        try {
            String uri = "/teams?league=" + props.getLeagueId() + "&season=" + props.getSeason();
            Map<?, ?> body = restClient.get().uri(uri).retrieve().body(Map.class);
            if (body == null) return List.of();

            List<?> response = (List<?>) body.get("response");
            if (response == null) return List.of();

            List<ApiTeam> result = new ArrayList<>();
            for (Object item : response) {
                Map<?, ?> entry = (Map<?, ?>) item;
                Map<?, ?> team  = (Map<?, ?>) entry.get("team");
                result.add(new ApiTeam(
                        ((Number) team.get("id")).longValue(),
                        (String) team.get("name"),
                        (String) team.get("country")
                ));
            }
            return result;
        } catch (Exception e) {
            log.warn("api-football: teams fetch failed: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> fetchCountries() {
        try {
            Map<?, ?> body = restClient.get().uri("/countries").retrieve().body(Map.class);
            if (body == null) return Map.of();

            List<?> response = (List<?>) body.get("response");
            if (response == null) return Map.of();

            Map<String, String> result = new HashMap<>();
            for (Object item : response) {
                Map<?, ?> country = (Map<?, ?>) item;
                String name = (String) country.get("name");
                String code = (String) country.get("code");
                if (name != null && code != null) {
                    result.put(name, code.toLowerCase());
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("api-football: countries fetch failed: {}", e.getMessage());
            return Map.of();
        }
    }
}
