-- V9__daily_gage_system.sql
-- Replace per-match forfeits with a per-day gage system.
-- The player with the fewest points earned across all matches of a given day
-- receives the gage of the day, chosen/voted BEFORE the matches start.

-- 1. Remove per-match forfeit link (moved to daily_gages)
ALTER TABLE matches DROP COLUMN IF EXISTS forfeit_id;

-- 2. Enrich forfeit templates
ALTER TABLE forfeits ADD COLUMN IF NOT EXISTS times_completed INT NOT NULL DEFAULT 0;
ALTER TABLE forfeits ADD COLUMN IF NOT EXISTS proposed_by_id BIGINT REFERENCES users(id);

-- 3. Track earned points per participation (needed to identify daily loser)
ALTER TABLE bet_participations ADD COLUMN IF NOT EXISTS points_earned INT NOT NULL DEFAULT 0;

-- 4. Track when a user forfeit was completed
ALTER TABLE user_forfeits ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- 5. Daily gage: admin creates one gage per calendar day
CREATE TABLE IF NOT EXISTS daily_gages (
    id             BIGSERIAL PRIMARY KEY,
    match_date     DATE        NOT NULL,
    forfeit_id     BIGINT      REFERENCES forfeits(id),
    mode           VARCHAR(20) NOT NULL DEFAULT 'DIRECT'
                               CHECK (mode IN ('DIRECT', 'VOTE')),
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'ACTIVE', 'SETTLED')),
    assigned_to_id BIGINT      REFERENCES users(id),
    assigned_at    TIMESTAMP,
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_gages_date UNIQUE (match_date)
);

-- 6. Vote candidates (admin selects a pool; players vote)
CREATE TABLE IF NOT EXISTS daily_gage_candidates (
    id            BIGSERIAL PRIMARY KEY,
    daily_gage_id BIGINT NOT NULL REFERENCES daily_gages(id) ON DELETE CASCADE,
    forfeit_id    BIGINT NOT NULL REFERENCES forfeits(id),
    CONSTRAINT uq_dgc_gage_forfeit UNIQUE (daily_gage_id, forfeit_id)
);

-- 7. Player votes on candidates (+1 / -1, one vote per user per candidate)
CREATE TABLE IF NOT EXISTS daily_gage_votes (
    id           BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES daily_gage_candidates(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    vote         INT    NOT NULL CHECK (vote IN (-1, 1)),
    CONSTRAINT uq_dgv_candidate_user UNIQUE (candidate_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_gages_date   ON daily_gages(match_date);
CREATE INDEX IF NOT EXISTS idx_dgc_daily_gage      ON daily_gage_candidates(daily_gage_id);
CREATE INDEX IF NOT EXISTS idx_dgv_candidate       ON daily_gage_votes(candidate_id);
