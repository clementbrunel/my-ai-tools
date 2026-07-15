ALTER TABLE races ADD COLUMN reminder_sent            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN race_reminder_sent_date   DATE;
