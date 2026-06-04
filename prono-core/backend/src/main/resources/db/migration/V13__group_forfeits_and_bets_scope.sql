-- V13__group_forfeits_and_bets_scope.sql — Group-scoped forfeits + bets

-- Group-specific forfeit catalogue (replaces the global forfeits table for group play)
CREATE TABLE group_forfeits (
    id             BIGSERIAL PRIMARY KEY,
    group_id       BIGINT       NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    description    TEXT         NOT NULL,
    category       VARCHAR(100) NOT NULL DEFAULT 'General',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    times_completed INT         NOT NULL DEFAULT 0,
    proposed_by_id BIGINT       REFERENCES users(id),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_forfeits_group_id ON group_forfeits(group_id);

-- Group-specific user_forfeits (tracks assigned gages within a group)
CREATE TABLE group_user_forfeits (
    id             BIGSERIAL PRIMARY KEY,
    group_id       BIGINT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id        BIGINT    NOT NULL REFERENCES users(id),
    forfeit_id     BIGINT    NOT NULL REFERENCES group_forfeits(id),
    assigned_by_id BIGINT    NOT NULL REFERENCES users(id),
    bet_id         BIGINT    REFERENCES bets(id),
    is_completed   BOOLEAN   NOT NULL DEFAULT FALSE,
    completed_at   TIMESTAMP,
    assigned_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_user_forfeits_group_id ON group_user_forfeits(group_id);
CREATE INDEX idx_group_user_forfeits_user_id  ON group_user_forfeits(user_id);

-- Scope bets to a group
ALTER TABLE bets ADD COLUMN group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX idx_bets_group_id ON bets(group_id);

-- Scope daily_gages to a group
ALTER TABLE daily_gages ADD COLUMN group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX idx_daily_gages_group_id ON daily_gages(group_id);
