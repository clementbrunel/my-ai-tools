-- V27__seed_gu_group.sql — Second group GU + Clément as GROUP_ADMIN

-- Create the GU group (clement id=1)
INSERT INTO groups (name, description, invite_code, created_by)
VALUES ('GU', 'Service GU', 'GU2026', 1);
-- group id = 2

-- Add clement as GROUP_ADMIN
INSERT INTO group_members (group_id, user_id, role) VALUES
(2, 1, 'GROUP_ADMIN'); -- clement
