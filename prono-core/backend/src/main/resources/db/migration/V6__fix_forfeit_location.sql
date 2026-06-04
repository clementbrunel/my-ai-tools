-- V6__fix_forfeit_location.sql
-- Safety migration: moves forfeit_id from bets to matches
-- (handles installs that ran the old V4 which incorrectly added forfeit_id to bets).

-- Remove from bets if it was mistakenly added there
ALTER TABLE bets DROP COLUMN IF EXISTS forfeit_id;

-- Add to matches (idempotent)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit_id    BIGINT REFERENCES forfeits(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bettor_bonus  INT NOT NULL DEFAULT 5;
