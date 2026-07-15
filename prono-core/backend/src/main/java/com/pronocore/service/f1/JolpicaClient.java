package com.pronocore.service.f1;

/**
 * Minimal HTTP abstraction over the jolpica-f1 API (Ergast-compatible),
 * so the sync service can be unit-tested with canned JSON payloads.
 */
public interface JolpicaClient {

    /** GET https://api.jolpi.ca/ergast/f1/{path} and return the raw JSON body. */
    String get(String path);
}
