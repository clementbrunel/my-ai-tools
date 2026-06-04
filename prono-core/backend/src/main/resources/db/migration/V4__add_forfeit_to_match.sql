-- V4__add_forfeit_to_match.sql
-- Each match can optionally carry a forfeit (gage).
-- The user who bet the most on that match AND has at least one wrong prediction gets it.
-- bettor_bonus: bonus points awarded to the user with the most participations on a match.

ALTER TABLE matches ADD COLUMN forfeit_id  BIGINT REFERENCES forfeits(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN bettor_bonus INT    NOT NULL DEFAULT 5;

CREATE INDEX idx_matches_forfeit_id ON matches(forfeit_id);
