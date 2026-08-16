-- Club teams imported from football-data.org have no iso2 (they're not countries),
-- so flags can't be resolved for them. football-data.org's team payload includes a
-- crest image URL that we were discarding; store it as a logo fallback for those teams.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS crest_url VARCHAR(500);
