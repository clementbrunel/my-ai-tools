package com.specmerger.dto;

import java.util.UUID;

/**
 * A persisted document's id and current markdown — returned by generation, merge, and auto-save
 * calls alike. {@code sessionId} is the session (see {@link com.specmerger.entity.Session}) this
 * generation was attached to — created on the first generation of a session, unchanged after —
 * so the frontend always has a session id to keep (localStorage) for recovery, alongside this
 * particular document's own id (used for auto-saving edits to it).
 */
public record SpecGenerationResult(UUID id, String markdown, UUID sessionId) {
}
