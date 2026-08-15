-- Ligue 1 2026-2027 as a new FOOT competition, wired to api-football league 61.
-- Roster is intentionally left empty here — club rosters change every season
-- (promotion/relegation), so it's imported from api-football by an admin action
-- (POST /api/competitions/{id}/sync-teams-from-api-football) instead of being
-- hardcoded in a migration.
INSERT INTO competitions (name, sport, active, season, api_football_league_id)
SELECT 'Ligue 1 2026-2027', 'FOOT', true, 2026, 61
WHERE NOT EXISTS (SELECT 1 FROM competitions WHERE name = 'Ligue 1 2026-2027');
