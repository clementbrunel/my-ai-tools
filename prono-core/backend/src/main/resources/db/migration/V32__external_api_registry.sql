-- V30__external_api_registry.sql
-- Introduces a sport/external-API registry and moves match external IDs
-- out of the matches table into a dedicated liaison table.

-- ----------------------------------------------------------------
-- sports
-- ----------------------------------------------------------------
CREATE TABLE sports (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50)  NOT NULL UNIQUE   -- UPPERCASE, e.g. 'FOOTBALL'
);

-- ----------------------------------------------------------------
-- external_apis
-- ----------------------------------------------------------------
CREATE TABLE external_apis (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,  -- UPPERCASE, e.g. 'API-FOOTBALL'
    sport_id    BIGINT       NOT NULL REFERENCES sports(id),
    base_url    VARCHAR(255),
    description TEXT
);

-- ----------------------------------------------------------------
-- match_external_links  (one row per match, one column per external API)
-- ----------------------------------------------------------------
CREATE TABLE match_external_links (
    match_id                 BIGINT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    api_football_fixture_id  BIGINT NULL
);

CREATE INDEX idx_mel_api_football ON match_external_links(api_football_fixture_id);

-- ----------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------
INSERT INTO sports (name, code) VALUES ('Football', 'FOOTBALL');

INSERT INTO external_apis (name, code, sport_id, base_url, description) VALUES
    ('API-Football', 'API-FOOTBALL', 1,
     'https://v3.football.api-sports.io',
     'API-Sports football provider (api-football.com). Auth: x-apisports-key header.');

-- ----------------------------------------------------------------
-- Migrate existing data from matches.external_fixture_id
-- ----------------------------------------------------------------
INSERT INTO match_external_links (match_id, api_football_fixture_id)
SELECT id, external_fixture_id
FROM   matches
WHERE  external_fixture_id IS NOT NULL;

ALTER TABLE matches DROP COLUMN external_fixture_id;
