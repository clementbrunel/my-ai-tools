-- V12__groups.sql — Play groups + extended roles

-- Extend role enum values (PostgreSQL: rename + re-add)
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20);

CREATE TABLE groups (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    invite_code VARCHAR(20)  NOT NULL UNIQUE,
    created_by  BIGINT       NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
    id         BIGSERIAL PRIMARY KEY,
    group_id   BIGINT       NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    BIGINT       NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role       VARCHAR(20)  NOT NULL DEFAULT 'MEMBER',  -- GROUP_ADMIN | MEMBER
    joined_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id  ON group_members(user_id);
