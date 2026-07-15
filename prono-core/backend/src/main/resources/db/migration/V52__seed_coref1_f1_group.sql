-- V52__seed_coref1_f1_group.sql — New F1-only group "Unité Core - F1", fresh start (no carried-over scores)

INSERT INTO groups (name, description, invite_code, created_by)
VALUES ('Unité Core - F1', 'Le groupe Unité Core, version F1 — on repart de zéro !', 'COREF12026', 1);

INSERT INTO group_sports (group_id, sport)
SELECT id, 'F1' FROM groups WHERE invite_code = 'COREF12026';

-- Add clement as GROUP_ADMIN; other members will join with the invite code
INSERT INTO group_members (group_id, user_id, role)
SELECT id, 1, 'GROUP_ADMIN' FROM groups WHERE invite_code = 'COREF12026';
