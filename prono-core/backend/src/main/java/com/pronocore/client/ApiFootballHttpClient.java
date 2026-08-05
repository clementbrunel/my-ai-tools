package com.pronocore.client;

/**
 * Minimal HTTP abstraction over the api-football v3 API, so the parsing,
 * caching and batching in {@link ApiFootballClient} can be unit-tested with
 * canned JSON payloads. Mirrors {@code JolpicaClient} on the F1 side.
 */
public interface ApiFootballHttpClient {

    /** GET https://v3.football.api-sports.io/{path} and return the raw JSON body. */
    String get(String path);
}
