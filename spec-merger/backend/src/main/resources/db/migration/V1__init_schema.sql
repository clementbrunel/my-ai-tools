CREATE TABLE analysis_session (
    id                UUID PRIMARY KEY,
    title             VARCHAR(255),
    word_filename     VARCHAR(255),
    jxml_source_type  VARCHAR(20) NOT NULL,
    jxml_filename     VARCHAR(255),
    status            VARCHAR(20) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_version (
    id              UUID PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES analysis_session(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    content         TEXT NOT NULL,
    source          VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, version_number)
);

CREATE TABLE divergence (
    id                  UUID PRIMARY KEY,
    session_id          UUID NOT NULL REFERENCES analysis_session(id) ON DELETE CASCADE,
    section_ref         VARCHAR(255),
    word_excerpt        TEXT,
    jxml_excerpt        TEXT,
    ai_proposal         TEXT,
    resolution_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    resolved_value      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_version_session ON document_version(session_id);
CREATE INDEX idx_divergence_session ON divergence(session_id);
