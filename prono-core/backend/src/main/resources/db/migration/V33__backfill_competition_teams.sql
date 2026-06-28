-- Backfill competition_teams from all existing matches (teamA and teamB).
-- ON CONFLICT DO NOTHING handles the unique constraint gracefully if any rows
-- were already inserted manually.
INSERT INTO competition_teams (competition, team_name)
SELECT DISTINCT competition, team_a FROM matches
UNION
SELECT DISTINCT competition, team_b FROM matches
ON CONFLICT ON CONSTRAINT uq_competition_team DO NOTHING;
