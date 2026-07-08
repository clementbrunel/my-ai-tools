-- V40__matches_competition_fk.sql
-- Add FK column pointing to competitions
ALTER TABLE matches ADD COLUMN competition_id BIGINT REFERENCES competitions(id);

-- Backfill from the existing name column, creating any competition not yet known
INSERT INTO competitions (name)
SELECT DISTINCT m.competition
FROM matches m
LEFT JOIN competitions c ON c.name = m.competition
WHERE c.id IS NULL;

UPDATE matches SET competition_id = (SELECT id FROM competitions WHERE name = matches.competition);

-- Safety check: abort if any match has no corresponding competition entry
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM matches WHERE competition_id IS NULL) THEN
        RAISE EXCEPTION 'Migration aborted: some matches have no matching competition in competitions table.';
    END IF;
END
$$;

ALTER TABLE matches ALTER COLUMN competition_id SET NOT NULL;

-- Drop the old VARCHAR column
ALTER TABLE matches DROP COLUMN competition;

-- Index for FK lookups
CREATE INDEX idx_matches_competition_id ON matches(competition_id);
