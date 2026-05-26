-- V7__starting_score.sql
-- Every player starts with 10 points (seed wallet).
-- Scoring rules: +5 exact score, +3 correct result, +0 wrong.
UPDATE users SET global_score = 10 WHERE global_score = 0;
