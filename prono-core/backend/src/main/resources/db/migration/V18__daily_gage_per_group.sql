-- V18__daily_gage_per_group.sql
-- The "gage du jour" becomes per (group, day): each group runs its own daily gage,
-- and the loser is computed among that group's participations only.

-- Backfill any orphan daily gages onto the seed group (V14 already did this, defensive).
UPDATE daily_gages SET group_id = (SELECT MIN(id) FROM groups) WHERE group_id IS NULL;

-- One daily gage per day GLOBALLY (V9) becomes one per (group, day).
ALTER TABLE daily_gages DROP CONSTRAINT IF EXISTS uq_daily_gages_date;
ALTER TABLE daily_gages ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE daily_gages ADD CONSTRAINT uq_daily_gages_group_date UNIQUE (group_id, match_date);
