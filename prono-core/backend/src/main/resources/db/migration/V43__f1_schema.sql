-- V43__f1_schema.sql — Module F1 : courses, pilotes, pronostics structurés.
--
-- Principe : le pipeline de points reste le pipeline générique
-- bets → bet_participations.points_earned (classement, gages, forfeits).
-- Un pari F1 est un bet ordinaire pointant vers une course (bets.race_id) ;
-- le détail du prono (podium, pole, meilleur tour, lanterne rouge) part
-- dans f1_predictions, liée à la participation.

-- Une compétition porte désormais un sport (la CDM 2026 reste FOOT).
ALTER TABLE competitions ADD COLUMN sport VARCHAR(10) NOT NULL DEFAULT 'FOOT';

CREATE TABLE constructors (
    id    BIGSERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(7)   NOT NULL,  -- hex écurie, teinte les mini-F1 du frontend
    CONSTRAINT uq_constructor_name UNIQUE (name)
);

CREATE TABLE drivers (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    code           VARCHAR(3)   NOT NULL,  -- trigramme FIA : VER, NOR…
    number         INT          NOT NULL,
    constructor_id BIGINT       NOT NULL REFERENCES constructors(id),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_driver_name UNIQUE (name)
);

CREATE TABLE races (
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,   -- "GP de Monaco"
    country_iso2     VARCHAR(10),
    circuit          VARCHAR(100),
    round            INT          NOT NULL,   -- manche 1..24
    qualifying_date  TIMESTAMP    NOT NULL,   -- verrou du pick pole
    race_date        TIMESTAMP    NOT NULL,   -- verrou des autres picks
    status           VARCHAR(20)  NOT NULL DEFAULT 'UPCOMING',  -- UPCOMING | FINISHED
    competition_id   BIGINT       NOT NULL REFERENCES competitions(id),
    CONSTRAINT uq_race_competition_round UNIQUE (competition_id, round)
);

-- Classement complet d'une course, saisi par l'admin (import auto plus tard).
-- position NULL = non classé (abandon sans classement).
CREATE TABLE race_results (
    id          BIGSERIAL PRIMARY KEY,
    race_id     BIGINT  NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id   BIGINT  NOT NULL REFERENCES drivers(id),
    position    INT,
    pole        BOOLEAN NOT NULL DEFAULT FALSE,
    fastest_lap BOOLEAN NOT NULL DEFAULT FALSE,
    dnf         BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_race_result UNIQUE (race_id, driver_id)
);

-- Un bet référence un match OU une course, jamais les deux.
ALTER TABLE bets ADD COLUMN race_id BIGINT REFERENCES races(id);
ALTER TABLE bets ADD CONSTRAINT chk_bets_single_subject
    CHECK (match_id IS NULL OR race_id IS NULL);
-- Un seul pari par (course, groupe) — pendant de uq_bets_match_group.
CREATE UNIQUE INDEX uq_bets_race_group ON bets (race_id, group_id)
    WHERE race_id IS NOT NULL;

-- Payload structuré d'un prono F1 (formule "Podium +").
-- Le pick pole est verrouillé aux qualifs, les autres au départ de la course.
CREATE TABLE f1_predictions (
    id                        BIGSERIAL PRIMARY KEY,
    participation_id          BIGINT NOT NULL REFERENCES bet_participations(id) ON DELETE CASCADE,
    p1_driver_id              BIGINT NOT NULL REFERENCES drivers(id),
    p2_driver_id              BIGINT NOT NULL REFERENCES drivers(id),
    p3_driver_id              BIGINT NOT NULL REFERENCES drivers(id),
    pole_driver_id            BIGINT REFERENCES drivers(id),
    fastest_lap_driver_id     BIGINT REFERENCES drivers(id),
    last_classified_driver_id BIGINT REFERENCES drivers(id),
    CONSTRAINT uq_f1_prediction_participation UNIQUE (participation_id)
);

-- Un groupe joue à un ou plusieurs sports.
CREATE TABLE group_sports (
    group_id BIGINT      NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sport    VARCHAR(10) NOT NULL,  -- FOOT | F1
    PRIMARY KEY (group_id, sport)
);

-- Tous les groupes existants jouent au foot.
INSERT INTO group_sports (group_id, sport)
SELECT id, 'FOOT' FROM groups;

CREATE INDEX idx_race_results_race_id ON race_results(race_id);
CREATE INDEX idx_bets_race_id ON bets(race_id);
