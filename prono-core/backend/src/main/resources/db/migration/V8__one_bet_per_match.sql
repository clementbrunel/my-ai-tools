-- V8__one_bet_per_match.sql
-- Enforce 1 bet per match. Auto-create missing bets.

-- 1. Remove duplicate bets per match (keep lowest id)
DELETE FROM bets b1 USING bets b2
WHERE b1.match_id = b2.match_id
  AND b1.match_id IS NOT NULL
  AND b1.id > b2.id;

-- 2. Unique constraint: 1 bet per match
ALTER TABLE bets ADD CONSTRAINT uq_bets_match_id UNIQUE (match_id);

-- 3. Auto-create bets for all matches that don't have one yet
INSERT INTO bets (title, match_id, creator_id, bet_type, points, deadline, status)
SELECT
  m.team_a || ' vs ' || m.team_b,
  m.id,
  (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1),
  'SCORE',
  10,
  m.match_date,
  'OPEN'
FROM matches m
WHERE NOT EXISTS (SELECT 1 FROM bets b WHERE b.match_id = m.id)
ORDER BY m.id;
