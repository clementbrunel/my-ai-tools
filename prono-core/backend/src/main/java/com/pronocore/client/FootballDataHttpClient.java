package com.pronocore.client;

/**
 * Minimal HTTP abstraction over the football-data.org v4 API, so the parsing,
 * caching and batching in {@link FootballDataClient} can be unit-tested with
 * canned JSON payloads.
 */
public interface FootballDataHttpClient {

    /** GET https://api.football-data.org/v4/{path} and return the raw JSON body. */
    String get(String path);
}
