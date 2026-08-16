-- Group-level switch to fully disable the daily gage/forfeit mechanic.
-- Default TRUE preserves current behavior for all existing groups.
ALTER TABLE groups ADD COLUMN gages_enabled BOOLEAN NOT NULL DEFAULT TRUE;
