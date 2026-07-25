ALTER TABLE races ADD COLUMN qualifying_reminder_sent      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN qualifying_reminder_sent_date DATE;
