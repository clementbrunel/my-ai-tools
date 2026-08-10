-- Registry of external sports APIs, one row per provider.
-- `sport` mirrors the Sport enum (FOOT | F1) exactly like competitions.sport
-- and forfeits.sport, so a provider is always scoped to the sport it feeds.
CREATE TABLE external_apis (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    sport       VARCHAR(10)  NOT NULL,
    base_url    VARCHAR(255),
    description TEXT
);

CREATE INDEX idx_external_apis_sport ON external_apis(sport);

-- Per-match links to external fixture IDs (one row per match at most)
CREATE TABLE match_external_links (
    match_id                BIGINT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    api_football_fixture_id BIGINT NULL
);

CREATE INDEX idx_mel_api_football ON match_external_links(api_football_fixture_id);

INSERT INTO external_apis (name, code, sport, base_url, description) VALUES
    ('API-Football', 'API-FOOTBALL', 'FOOT', 'https://v3.football.api-sports.io',
     'API-Sports football provider. Auth: x-apisports-key header.'),
    ('jolpica-f1', 'JOLPICA', 'F1', 'https://api.jolpi.ca/ergast/f1',
     'Ergast-compatible F1 provider. Source of race calendars, grids and results.');
