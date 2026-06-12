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
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around the api-sports.io / api-football.com v3 REST API.
 *
 * Rate limit: 100 req/day on the free tier.
 * Strategy: cache all WC fixtures once per day; fetch individual fixtures live
 * only during active match windows (called by MatchSyncService).
 */
@Slf4j
@Component
public class ApiFootballClient {

    /** Finished-match status codes returned by the API. */
    public static final java.util.Set<String> FINISHED_STATUSES =
            java.util.Set.of("FT", "AET", "PEN", "AWD", "WO");

    /** Live-match status codes. */
    public static final java.util.Set<String> LIVE_STATUSES =
            java.util.Set.of("1H", "HT", "2H", "ET", "BT", "P");

    // ----------------------------------------------------------------
    // Immutable DTO for one fixture from the API
    // ----------------------------------------------------------------

    public record ApiFixture(
            long           fixtureId,
            String         homeTeam,
            String         awayTeam,
            OffsetDateTime date,
            String         statusShort,   // e.g. "FT", "NS", "1H"
            Integer        homeGoals,     // null for NS
            Integer        awayGoals
    ) {}

    // ----------------------------------------------------------------
    // Fields
    // ----------------------------------------------------------------

    private final RestClient              restClient;
    private final ApiFootballProperties   props;

    private List<ApiFixture> cachedFixtures = null;
    private LocalDate        cacheDate      = null;

    public ApiFootballClient(@Qualifier("apiFootballRestClient") RestClient restClient,
                             ApiFootballProperties props) {
        this.restClient = restClient;
        this.props      = props;
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    /** Returns false when no API key is configured (no-op mode). */
    public boolean isDisabled() {
        return props.getApiKey() == null || props.getApiKey().isBlank();
    }

    /**
     * Returns all WC fixtures for the configured season.
     * Result is cached for the current UTC day (1 API call / day).
     */
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

    /** Fetches a single fixture by its API ID (live data, no cache). */
    public ApiFixture getFixture(long fixtureId) {
        if (isDisabled()) return null;
        List<ApiFixture> fixtures = fetchFixtures(fixtureId);
        return fixtures.isEmpty() ? null : fixtures.get(0);
    }

    /** Forces a refresh of the daily fixture cache (e.g. after linking). */
    public void invalidateCache() {
        cachedFixtures = null;
        cacheDate      = null;
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

            Map<?, ?> body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            if (body == null) return List.of();

            List<?> response = (List<?>) body.get("response");
            if (response == null) return List.of();

            List<ApiFixture> result = new ArrayList<>();
            for (Object item : response) {
                Map<?, ?> entry   = (Map<?, ?>) item;
                Map<?, ?> fixture = (Map<?, ?>) entry.get("fixture");
                Map<?, ?> teams   = (Map<?, ?>) entry.get("teams");
                Map<?, ?> goals   = (Map<?, ?>) entry.get("goals");
                Map<?, ?> status  = (Map<?, ?>) fixture.get("status");

                long   id         = ((Number) fixture.get("id")).longValue();
                String dateStr    = (String) fixture.get("date");
                String statusCode = (String) status.get("short");
                String home       = (String) ((Map<?, ?>) teams.get("home")).get("name");
                String away       = (String) ((Map<?, ?>) teams.get("away")).get("name");
                Integer hGoals    = goals != null && goals.get("home")  != null ? ((Number) goals.get("home")).intValue()  : null;
                Integer aGoals    = goals != null && goals.get("away")  != null ? ((Number) goals.get("away")).intValue()  : null;

                result.add(new ApiFixture(id, home, away,
                        OffsetDateTime.parse(dateStr), statusCode, hGoals, aGoals));
            }
            return result;
        } catch (Exception e) {
            log.warn("api-football fetch failed (uri contains id={}): {}", fixtureId, e.getMessage());
            return List.of();
        }
    }
}
