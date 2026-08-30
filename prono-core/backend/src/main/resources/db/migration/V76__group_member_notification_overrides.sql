-- Per-group override of the user's global email preferences (NULL = inherit the user's
-- global default for that group). Lets a member silence match reminders or gage
-- resolution emails in one group without affecting the others.
ALTER TABLE group_members ADD COLUMN email_reminder_enabled BOOLEAN;
ALTER TABLE group_members ADD COLUMN email_gage_enabled BOOLEAN;
