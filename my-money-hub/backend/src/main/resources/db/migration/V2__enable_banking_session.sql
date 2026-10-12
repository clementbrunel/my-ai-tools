-- Enable Banking: an institution needs the ASPSP country (with external_ref = ASPSP name) to start
-- a consent, and keeps the resulting session id until the consent expires.
ALTER TABLE institutions ADD COLUMN external_country    VARCHAR(2);
ALTER TABLE institutions ADD COLUMN external_session_id VARCHAR(100);
ALTER TABLE institutions ADD COLUMN session_valid_until TIMESTAMP;
