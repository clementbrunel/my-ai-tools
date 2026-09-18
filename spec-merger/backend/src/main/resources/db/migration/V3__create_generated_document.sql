-- Replaces the previous session-scoped persistence with one durable row per AI generation
-- (Word spec, JXML spec, or their merge) plus an append-only revision history, so the frontend
-- can recover a session by id (localStorage) and edits are never silently lost — see #263.
CREATE TABLE generated_document (
    id                 UUID PRIMARY KEY,
    source             VARCHAR(20) NOT NULL,
    word_document_id   UUID REFERENCES generated_document(id),
    jxml_document_id   UUID REFERENCES generated_document(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_revision (
    id               UUID PRIMARY KEY,
    document_id      UUID NOT NULL REFERENCES generated_document(id) ON DELETE CASCADE,
    revision_number  INT NOT NULL,
    content          TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, revision_number)
);

CREATE INDEX idx_document_revision_document ON document_revision(document_id);
