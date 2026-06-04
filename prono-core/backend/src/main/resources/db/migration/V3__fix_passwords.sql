-- V3__fix_passwords.sql
-- Fixes bcrypt hashes that were incorrectly generated in V2.
-- Real hashes computed with bcrypt(password, rounds=10).

UPDATE users SET password = '$2b$10$zCQrNboNF5xNcR/Ia1Dliu895Bk5C00NuEvtD6jJNZitXMXKdJUHq' -- guardrails:ignore
WHERE username = 'admin';

UPDATE users SET password = '$2b$10$lozahdpOr09r44mKYxf3weqOaTcnzq2ETyliM.2kpIw0Qym.eNzIS' -- guardrails:ignore
WHERE username IN ('demo','lucas','marie','thomas','sophie','pierre','julie','maxime','camille');
