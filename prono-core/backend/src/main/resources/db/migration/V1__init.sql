-- V1__init.sql - Initial schema

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    avatar_url VARCHAR(255),
    global_score INT NOT NULL DEFAULT 0,
    bets_won INT NOT NULL DEFAULT 0,
    forfeits_received INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    team_a VARCHAR(100) NOT NULL,
    team_b VARCHAR(100) NOT NULL,
    match_date TIMESTAMP NOT NULL,
    score_a INT,
    score_b INT,
    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
    competition VARCHAR(100) NOT NULL DEFAULT 'FIFA World Cup 2026',
    round VARCHAR(100) NOT NULL DEFAULT 'Group Stage'
);

CREATE TABLE bets (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
    creator_id BIGINT NOT NULL REFERENCES users(id),
    bet_type VARCHAR(20) NOT NULL DEFAULT 'FREE',
    points INT NOT NULL DEFAULT 10,
    deadline TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    winning_option VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE bet_participations (
    id BIGSERIAL PRIMARY KEY,
    bet_id BIGINT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    chosen_option VARCHAR(200) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(bet_id, user_id)
);

CREATE TABLE forfeits (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_forfeits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    forfeit_id BIGINT NOT NULL REFERENCES forfeits(id),
    assigned_by_id BIGINT NOT NULL REFERENCES users(id),
    bet_id BIGINT REFERENCES bets(id),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_creator_id ON bets(creator_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bet_participations_bet_id ON bet_participations(bet_id);
CREATE INDEX idx_bet_participations_user_id ON bet_participations(user_id);
CREATE INDEX idx_user_forfeits_user_id ON user_forfeits(user_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_match_date ON matches(match_date);
