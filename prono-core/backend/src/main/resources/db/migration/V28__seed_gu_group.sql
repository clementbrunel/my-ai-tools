-- V28__seed_gu_group.sql — Second group GU + Clément as GROUP_ADMIN

-- Create the GU group (clement id=1)
INSERT INTO groups (name, description, invite_code, created_by)
VALUES ('GU', 'Service GU', 'GU2026', 1);

-- Add clement as GROUP_ADMIN (use subquery to avoid hardcoding the generated id)
INSERT INTO group_members (group_id, user_id, role)
SELECT id, 1, 'GROUP_ADMIN' FROM groups WHERE invite_code = 'GU2026';
