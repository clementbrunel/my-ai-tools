-- Add privacy flag to groups
ALTER TABLE groups ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Add membership status to group_members (ACTIVE = full member, PENDING = waiting for admin approval)
ALTER TABLE group_members ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
