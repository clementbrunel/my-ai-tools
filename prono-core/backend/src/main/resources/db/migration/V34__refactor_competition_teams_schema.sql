-- Refactor: replace the flat competition_teams(competition VARCHAR, team_name VARCHAR)
-- with proper competitions and teams tables linked by a join table.

CREATE TABLE competitions (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_competition_name UNIQUE (name)
);

CREATE TABLE teams (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_team_name UNIQUE (name)
);

-- Populate from existing flat table
INSERT INTO competitions (name)
SELECT DISTINCT competition FROM competition_teams ORDER BY competition;

INSERT INTO teams (name)
SELECT DISTINCT team_name FROM competition_teams ORDER BY team_name;

-- Create proper join table and backfill
CREATE TABLE competition_team_links (
    competition_id BIGINT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    team_id        BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (competition_id, team_id)
);

INSERT INTO competition_team_links (competition_id, team_id)
SELECT c.id, t.id
FROM competition_teams ct
JOIN competitions c ON c.name = ct.competition
JOIN teams        t ON t.name  = ct.team_name;

-- Replace flat table with the new join table
DROP TABLE competition_teams;
ALTER TABLE competition_team_links RENAME TO competition_teams;
