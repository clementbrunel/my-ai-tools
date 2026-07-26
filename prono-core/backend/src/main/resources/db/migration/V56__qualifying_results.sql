-- V56__qualifying_results.sql — grille de départ, connue dès les qualifs (samedi soir),
-- bien avant le classement complet de la course (race_results, importé après la course).
--
-- Affichage seul : aide les joueurs à ajuster leur prono avant le départ. Aucun point
-- n'est réglé depuis cette table — le barème reste calculé sur race_results.
CREATE TABLE qualifying_results (
    id        BIGSERIAL PRIMARY KEY,
    race_id   BIGINT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES drivers(id),
    position  INT    NOT NULL,
    CONSTRAINT uq_qualifying_result UNIQUE (race_id, driver_id)
);

CREATE INDEX idx_qualifying_results_race_id ON qualifying_results(race_id);
