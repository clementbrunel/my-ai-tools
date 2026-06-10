ALTER TABLE users
    ADD COLUMN email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN verification_token VARCHAR(255),
    ADD COLUMN token_expiry    TIMESTAMP;

-- Existing users were created before email verification was introduced — mark them verified
UPDATE users SET email_verified = TRUE;
