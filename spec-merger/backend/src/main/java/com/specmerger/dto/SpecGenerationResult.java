package com.specmerger.dto;

import java.util.UUID;

/**
 * A persisted document's id and current markdown — returned by generation, merge, fetch, and
 * auto-save calls alike so the frontend always has an id to keep (localStorage) for recovery.
 */
public record SpecGenerationResult(UUID id, String markdown) {
}
