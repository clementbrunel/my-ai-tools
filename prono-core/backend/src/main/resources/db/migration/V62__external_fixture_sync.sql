-- Add sync-control columns to matches
ALTER TABLE matches ADD COLUMN sync_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN auto_synced BOOLEAN NOT NULL DEFAULT FALSE;
