CREATE TABLE forfeit_votes (
    id         BIGSERIAL PRIMARY KEY,
    forfeit_id BIGINT   NOT NULL REFERENCES forfeits(id) ON DELETE CASCADE,
    user_id    BIGINT   NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    CONSTRAINT uq_forfeit_vote UNIQUE (forfeit_id, user_id)
);
