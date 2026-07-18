-- Registry of external sports APIs (no sport FK — sport is implied by context)
CREATE TABLE external_apis (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    base_url    VARCHAR(255),
    description TEXT
);

-- Per-match links to external fixture IDs (one row per match at most)
CREATE TABLE match_external_links (
    match_id                BIGINT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    api_football_fixture_id BIGINT NULL
);

CREATE INDEX idx_mel_api_football ON match_external_links(api_football_fixture_id);

INSERT INTO external_apis (name, code, base_url, description) VALUES
    ('API-Football', 'API-FOOTBALL', 'https://v3.football.api-sports.io',
     'API-Sports football provider. Auth: x-apisports-key header.');
