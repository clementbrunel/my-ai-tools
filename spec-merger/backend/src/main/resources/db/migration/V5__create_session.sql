-- A session is now its own row, created as soon as the first document (Word or JXML) is
-- generated — its id is what the frontend keeps to recover a whole session later (merge or no
-- merge), instead of the previous "any document's own id doubles as a session id" scheme, which
-- left the same session reachable under several different-looking ids.
CREATE TABLE session (
    id                    UUID PRIMARY KEY,
    word_document_id      UUID REFERENCES generated_document(id),
    jxml_document_id      UUID REFERENCES generated_document(id),
    merged_document_id    UUID REFERENCES generated_document(id),
    gitlab_selection_json TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
