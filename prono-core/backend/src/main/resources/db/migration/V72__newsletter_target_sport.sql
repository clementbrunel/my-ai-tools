-- Optional sport targeting for newsletter broadcasts. Null preserves current
-- behavior (sent to every opted-in user); a value restricts delivery to
-- members of groups playing that sport.
ALTER TABLE newsletter ADD COLUMN target_sport VARCHAR(10) NULL;
