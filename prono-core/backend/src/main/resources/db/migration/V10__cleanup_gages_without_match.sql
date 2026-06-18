-- V10: Remove daily_gage entries whose match_date has no corresponding match.
-- This sanitises any rows that were created before the "match must exist"
-- validation was introduced.

-- 1. Votes on orphan candidates
DELETE FROM daily_gage_votes
WHERE candidate_id IN (
    SELECT dgc.id
    FROM   daily_gage_candidates dgc
    JOIN   daily_gages dg ON dg.id = dgc.daily_gage_id
    WHERE  NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE CAST(m.match_date AS DATE) = dg.match_date
    )
);

-- 2. Orphan candidates
DELETE FROM daily_gage_candidates
WHERE daily_gage_id IN (
    SELECT id FROM daily_gages dg
    WHERE NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE CAST(m.match_date AS DATE) = dg.match_date
    )
);

-- 3. The orphan daily_gage rows themselves
DELETE FROM daily_gages
WHERE NOT EXISTS (
    SELECT 1 FROM matches m
    WHERE CAST(m.match_date AS DATE) = daily_gages.match_date
);
