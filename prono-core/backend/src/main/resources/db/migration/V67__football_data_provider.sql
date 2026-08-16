-- api-football's free plan doesn't cover the current season (only a rolling
-- 2-3 year-old historical window), which makes it useless for live sync on a
-- free budget — nothing had actually synced through it yet, so it's replaced
-- outright rather than kept alongside this. football-data.org's free tier
-- explicitly covers the current season for 12 major competitions (Ligue 1
-- included). The api_football_league_id column and API-FOOTBALL registry row
-- from earlier migrations are left in place (unused) rather than dropped.
ALTER TABLE competitions ADD COLUMN football_data_competition_code VARCHAR(10);
ALTER TABLE match_external_links ADD COLUMN football_data_match_id BIGINT;

CREATE INDEX idx_mel_football_data ON match_external_links(football_data_match_id);

INSERT INTO external_apis (name, code, sport, base_url, description) VALUES
    ('football-data.org', 'FOOTBALL-DATA', 'FOOT', 'https://api.football-data.org/v4',
     'football-data.org provider. Free tier covers the current season for 12 major competitions. Auth: X-Auth-Token header.');

-- Ligue 1 2026-2027 → football-data.org competition code FL1.
UPDATE competitions SET football_data_competition_code = 'FL1' WHERE name = 'Ligue 1 2026-2027';
