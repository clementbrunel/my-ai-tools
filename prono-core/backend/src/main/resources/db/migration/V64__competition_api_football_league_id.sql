-- Each football competition now carries its own api-football league id, so
-- the sync/linking pipeline can query multiple leagues (World Cup, Ligue 1...)
-- instead of a single global league configured in application.yml.
ALTER TABLE competitions ADD COLUMN api_football_league_id INTEGER;

-- Backfill existing football competitions with the previously-global league id (1 = World Cup).
UPDATE competitions SET api_football_league_id = 1 WHERE sport = 'FOOT' AND api_football_league_id IS NULL;
