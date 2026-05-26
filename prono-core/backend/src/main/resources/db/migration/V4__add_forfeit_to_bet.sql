-- V4__add_forfeit_to_bet.sql
-- Adds an optional forfeit to a bet: if the user loses this bet, that forfeit is applied.

ALTER TABLE bets ADD COLUMN forfeit_id BIGINT REFERENCES forfeits(id) ON DELETE SET NULL;

CREATE INDEX idx_bets_forfeit_id ON bets(forfeit_id);
