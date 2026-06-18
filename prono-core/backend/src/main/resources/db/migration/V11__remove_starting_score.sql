-- V11: Remove the 10-point seed wallet introduced in V7.
-- With the daily-gage system the "loser of the day" is determined by
-- points earned that day, so a universal starting bonus is irrelevant
-- and distorts the leaderboard for players who haven't played yet.
--
-- Subtract 10 from every player, floored at 0 to avoid negative scores
-- for users whose score was never updated above the seed.
UPDATE users
SET global_score = GREATEST(global_score - 10, 0);
