-- V73__f1_seed_tsunoda.sql — Yuki Tsunoda joins the picker roster.
--
-- Not part of the 2026 grid seeded in V45 (drivers rows are otherwise only ever
-- created by the jolpica sync, which only learns about a driver once a session
-- he took part in has been run — too late for players to pick him before that
-- session's qualifying lock). Seeding him now makes him pickable ahead of a
-- one-off race for Racing Bulls; the "raced for" team on his actual result is
-- still set per-race (race_results.constructor_id, V72), independently of this
-- row's constructor_id, so this is safe even if his stint turns out longer or
-- shorter than expected.

INSERT INTO drivers (name, code, number, constructor_id, is_active)
SELECT 'Yuki Tsunoda', 'TSU', 22, (SELECT id FROM constructors WHERE name = 'Racing Bulls'), TRUE
WHERE NOT EXISTS (SELECT 1 FROM drivers WHERE name = 'Yuki Tsunoda');
