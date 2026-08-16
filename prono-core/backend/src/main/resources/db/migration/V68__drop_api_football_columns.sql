-- api-football is fully replaced by football-data.org (V67) — its free plan doesn't
-- cover the current season, and no application code reads these columns anymore.
-- Drops the linkage columns (also removes their indexes) and the now-orphaned
-- API-FOOTBALL registry row. Note: this discards the historical fixture-id linkage
-- for already-synced matches (e.g. World Cup 2026) — harmless since nothing in the
-- app reads it anymore, but irreversible.
ALTER TABLE match_external_links DROP COLUMN api_football_fixture_id;
ALTER TABLE competitions DROP COLUMN api_football_league_id;

DELETE FROM external_apis WHERE code = 'API-FOOTBALL';
