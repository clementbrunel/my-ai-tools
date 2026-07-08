-- V41__matches_team_fk.sql
-- Add FK columns pointing to teams
ALTER TABLE matches ADD COLUMN team_a_id BIGINT REFERENCES teams(id);
ALTER TABLE matches ADD COLUMN team_b_id BIGINT REFERENCES teams(id);

-- Backfill from existing name columns
UPDATE matches SET team_a_id = (SELECT id FROM teams WHERE name = team_a);
UPDATE matches SET team_b_id = (SELECT id FROM teams WHERE name = team_b);

-- Safety check: abort if any match has no corresponding team entry
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM matches WHERE team_a_id IS NULL OR team_b_id IS NULL) THEN
        RAISE EXCEPTION 'Migration aborted: some matches have no matching team in teams table. Populate teams first.';
    END IF;
END
$$;

ALTER TABLE matches ALTER COLUMN team_a_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN team_b_id SET NOT NULL;

-- Drop the old VARCHAR columns
ALTER TABLE matches DROP COLUMN team_a;
ALTER TABLE matches DROP COLUMN team_b;

-- Indexes for FK lookups
CREATE INDEX idx_matches_team_a_id ON matches(team_a_id);
CREATE INDEX idx_matches_team_b_id ON matches(team_b_id);
