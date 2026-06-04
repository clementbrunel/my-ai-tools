-- V16__bet_per_group.sql
-- A bet now belongs to a (match, group) pair.
-- A match is global (created by a platform admin) and is NOT automatically
-- open for betting. A GROUP ADMIN explicitly opens a match for betting in
-- their group, which creates the bet. The same match can therefore yield
-- 0, 1 or N bets — one per group that opened it.

-- Backfill any orphan bets (created before group scoping was enforced) onto the
-- seed group so the NOT NULL + uniqueness constraints below can be applied.
UPDATE bets SET group_id = (SELECT MIN(id) FROM groups) WHERE group_id IS NULL;

-- Replace "one bet per match globally" (V8) with "one bet per (match, group)".
ALTER TABLE bets DROP CONSTRAINT IF EXISTS uq_bets_match_id;
ALTER TABLE bets ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE bets ADD CONSTRAINT uq_bets_match_group UNIQUE (match_id, group_id);
