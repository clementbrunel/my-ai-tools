package com.pronocore.client;

import com.pronocore.config.ApiFootballProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiFootballClientTest {

    @Mock private ApiFootballHttpClient http;

    private ApiFootballClient client;

    @BeforeEach
    void setUp() {
        ApiFootballProperties props = new ApiFootballProperties();
        props.setApiKey("test-key");
        client = new ApiFootballClient(http, props);
    }

    /** One fixture kicking off at 19:00 UTC — that is 21:00 Paris time in June. */
    private static final String ONE_FIXTURE = """
            {"response":[{
              "fixture":{"id":42,"date":"2026-06-11T19:00:00+00:00","status":{"short":"FT"}},
              "league":{"round":"Regular Season - 1"},
              "teams":{"home":{"id":1,"name":"France"},"away":{"id":2,"name":"Brésil"}},
              "goals":{"home":2,"away":1}
            }]}
            """;

    // ── Parsing ───────────────────────────────────────────────────────────────

    @Test
    void parsesFixtureFields() {
        when(http.get(anyString())).thenReturn(ONE_FIXTURE);

        ApiFootballClient.ApiFixture fixture = client.getAllFixtures(1, 2026).get(0);

        assertThat(fixture.fixtureId()).isEqualTo(42L);
        assertThat(fixture.homeTeamName()).isEqualTo("France");
        assertThat(fixture.awayTeamName()).isEqualTo("Brésil");
        assertThat(fixture.statusShort()).isEqualTo("FT");
        assertThat(fixture.goalsHome()).isEqualTo(2);
        assertThat(fixture.goalsAway()).isEqualTo(1);
        assertThat(fixture.round()).isEqualTo("Regular Season - 1");
    }

    @Test
    void convertsApiOffsetToParisLocalTime() {
        when(http.get(anyString())).thenReturn(ONE_FIXTURE);

        LocalDateTime date = client.getAllFixtures(1, 2026).get(0).date();

        // 19:00Z in June is 21:00 in Europe/Paris — matches how match dates are stored.
        assertThat(date).isEqualTo(LocalDateTime.of(2026, 6, 11, 21, 0));
    }

    @Test
    void readsNullGoalsAsNull() {
        when(http.get(anyString())).thenReturn("""
                {"response":[{
                  "fixture":{"id":7,"date":"2026-06-11T19:00:00+00:00","status":{"short":"NS"}},
                  "teams":{"home":{"id":1,"name":"A"},"away":{"id":2,"name":"B"}},
                  "goals":{"home":null,"away":null}
                }]}
                """);

        ApiFootballClient.ApiFixture fixture = client.getAllFixtures(1, 2026).get(0);

        assertThat(fixture.goalsHome()).isNull();
        assertThat(fixture.goalsAway()).isNull();
    }

    // ── Batching ──────────────────────────────────────────────────────────────

    @Test
    void batchesFixtureIdsIntoCallsOfTwenty() {
        when(http.get(anyString())).thenReturn("{\"response\":[]}");

        client.getFixtures(LongStream.rangeClosed(1, 25).boxed().toList());

        ArgumentCaptor<String> paths = ArgumentCaptor.forClass(String.class);
        verify(http, times(2)).get(paths.capture());
        assertThat(paths.getAllValues().get(0)).contains("ids=1-2-3");
        assertThat(paths.getAllValues().get(1)).contains("ids=21-22-23-24-25");
    }

    @Test
    void deduplicatesFixtureIdsAndSkipsEmptyRequests() {
        assertThat(client.getFixtures(List.of())).isEmpty();
        verifyNoInteractions(http);
    }

    // ── Caching ───────────────────────────────────────────────────────────────

    @Test
    void servesSeasonFixturesFromCacheUntilInvalidated() {
        when(http.get(anyString())).thenReturn(ONE_FIXTURE);

        client.getAllFixtures(1, 2026);
        client.getAllFixtures(1, 2026);
        verify(http, times(1)).get(anyString());

        client.invalidateCache();
        client.getAllFixtures(1, 2026);
        verify(http, times(2)).get(anyString());
    }

    @Test
    void cachesFixturesSeparatelyPerLeagueAndSeason() {
        when(http.get(anyString())).thenReturn(ONE_FIXTURE);

        client.getAllFixtures(1, 2026);   // World Cup
        client.getAllFixtures(61, 2026);  // Ligue 1
        client.getAllFixtures(1, 2026);   // World Cup again — served from cache

        verify(http, times(2)).get(anyString());
    }

    @Test
    void isDisabledWhenNoApiKeyConfigured() {
        ApiFootballProperties blank = new ApiFootballProperties();
        blank.setApiKey("");
        assertThat(new ApiFootballClient(http, blank).isDisabled()).isTrue();
        assertThat(client.isDisabled()).isFalse();
    }
}
