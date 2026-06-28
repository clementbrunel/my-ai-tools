CREATE TABLE competition_teams (
    id          BIGSERIAL PRIMARY KEY,
    competition VARCHAR(100) NOT NULL,
    team_name   VARCHAR(100) NOT NULL,
    CONSTRAINT uq_competition_team UNIQUE (competition, team_name)
);
