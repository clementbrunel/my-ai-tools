package com.pronocore.client;

import com.pronocore.config.FootballDataProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FootballDataClientTest {

    @Mock private FootballDataHttpClient http;

    private FootballDataClient client;

    @BeforeEach
    void setUp() {
        FootballDataProperties props = new FootballDataProperties();
        props.setApiKey("test-key");
        client = new FootballDataClient(http, props);
    }

    /** One match kicking off at 19:00 UTC — that is 21:00 Paris time in August. */
    private static final String ONE_MATCH = """
            {"matches":[{
              "id":42,"utcDate":"2026-08-20T19:00:00Z","status":"FINISHED","matchday":1,
              "homeTeam":{"id":1,"name":"Paris Saint-Germain FC"},
              "awayTeam":{"id":2,"name":"Olympique de Marseille"},
              "score":{"fullTime":{"home":2,"away":1}}
            }]}
            """;

    // ── Parsing ───────────────────────────────────────────────────────────────

    @Test
    void parsesMatchFields() {
        when(http.get(anyString())).thenReturn(ONE_MATCH);

        FootballDataClient.FdMatch match = client.getSeasonMatches("FL1", 2026).get(0);

        assertThat(match.id()).isEqualTo(42L);
        assertThat(match.homeTeamName()).isEqualTo("Paris Saint-Germain FC");
        assertThat(match.awayTeamName()).isEqualTo("Olympique de Marseille");
        assertThat(match.status()).isEqualTo("FINISHED");
        assertThat(match.goalsHome()).isEqualTo(2);
        assertThat(match.goalsAway()).isEqualTo(1);
        assertThat(match.matchday()).isEqualTo(1);
    }

    @Test
    void convertsUtcDateToParisLocalTime() {
        when(http.get(anyString())).thenReturn(ONE_MATCH);

        LocalDateTime date = client.getSeasonMatches("FL1", 2026).get(0).date();

        // 19:00Z in August is 21:00 in Europe/Paris — matches how match dates are stored.
        assertThat(date).isEqualTo(LocalDateTime.of(2026, 8, 20, 21, 0));
    }

    @Test
    void readsNullGoalsAsNull() {
        when(http.get(anyString())).thenReturn("""
                {"matches":[{
                  "id":7,"utcDate":"2026-08-20T19:00:00Z","status":"SCHEDULED","matchday":1,
                  "homeTeam":{"id":1,"name":"A"},"awayTeam":{"id":2,"name":"B"},
                  "score":{"fullTime":{"home":null,"away":null}}
                }]}
                """);

        FootballDataClient.FdMatch match = client.getSeasonMatches("FL1", 2026).get(0);

        assertThat(match.goalsHome()).isNull();
        assertThat(match.goalsAway()).isNull();
    }

    @Test
    void parsesTeamFields() {
        when(http.get(anyString())).thenReturn("""
                {"teams":[{"id":524,"name":"Paris Saint-Germain FC","shortName":"PSG"}]}
                """);

        FootballDataClient.FdTeam team = client.getTeams("FL1", 2026).get(0);

        assertThat(team.id()).isEqualTo(524L);
        assertThat(team.name()).isEqualTo("Paris Saint-Germain FC");
        assertThat(team.shortName()).isEqualTo("PSG");
    }

    // ── Caching ───────────────────────────────────────────────────────────────

    @Test
    void servesSeasonMatchesFromCacheUntilInvalidated() {
        when(http.get(anyString())).thenReturn(ONE_MATCH);

        client.getSeasonMatches("FL1", 2026);
        client.getSeasonMatches("FL1", 2026);
        verify(http, times(1)).get(anyString());

        client.invalidateCache();
        client.getSeasonMatches("FL1", 2026);
        verify(http, times(2)).get(anyString());
    }

    @Test
    void cachesMatchesSeparatelyPerCompetitionAndSeason() {
        when(http.get(anyString())).thenReturn(ONE_MATCH);

        client.getSeasonMatches("FL1", 2026);
        client.getSeasonMatches("WC", 2026);
        client.getSeasonMatches("FL1", 2026); // served from cache

        verify(http, times(2)).get(anyString());
    }

    @Test
    void neverCachesTheSyncWindowPoll() {
        when(http.get(anyString())).thenReturn(ONE_MATCH);

        client.getMatchesInWindow("FL1", LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 20));
        client.getMatchesInWindow("FL1", LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 20));

        verify(http, times(2)).get(anyString());
    }

    @Test
    void windowPollUsesDateOnlyQueryParams() {
        when(http.get(anyString())).thenReturn("{\"matches\":[]}");

        client.getMatchesInWindow("FL1", LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 22));

        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(http).get(path.capture());
        assertThat(path.getValue()).contains("dateFrom=2026-08-20").contains("dateTo=2026-08-22");
    }

    @Test
    void isDisabledWhenNoApiKeyConfigured() {
        FootballDataProperties blank = new FootballDataProperties();
        blank.setApiKey("");
        assertThat(new FootballDataClient(http, blank).isDisabled()).isTrue();
        assertThat(client.isDisabled()).isFalse();
    }

    @Test
    void isDisabledWhenApiKeyIsThePlaceholderFromEnvExample() {
        FootballDataProperties placeholder = new FootballDataProperties();
        placeholder.setApiKey("your_football_data_api_key_here");
        assertThat(new FootballDataClient(http, placeholder).isDisabled()).isTrue();
    }
}
