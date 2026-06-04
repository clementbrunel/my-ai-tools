-- V19__group_forfeits_tracking_and_drop_bettor_bonus.sql

-- Track which group a gage assignment belongs to, so "Roi des gages" can be
-- computed per group on the group leaderboard.
ALTER TABLE user_forfeits ADD COLUMN group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX idx_user_forfeits_group_id ON user_forfeits(group_id);

-- Backfill from the linked bet's group where available (bet-driven FORFEIT assignments).
UPDATE user_forfeits uf SET group_id = b.group_id
FROM bets b WHERE uf.bet_id = b.id AND uf.group_id IS NULL;

-- Remove the never-implemented bettor_bonus tie-break. The group leaderboard already
-- breaks ties by the number of bets won, which is the meaningful tie-breaker.
ALTER TABLE matches DROP COLUMN IF EXISTS bettor_bonus;
