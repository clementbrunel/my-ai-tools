-- V39__quarter_final_matches.sql
-- FIFA World Cup 2026 — 4 matchs des quarts de finale
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les 8es de finale.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)

INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round, phase) VALUES

-- Mercredi 8 juillet
('France',    'Maroc',      '2026-07-08 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale', 'KNOCKOUT'),

-- Vendredi 10 juillet
('Espagne',   'Belgique',   '2026-07-10 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale', 'KNOCKOUT'),

-- Samedi 11 juillet
('Norvège',   'Angleterre', '2026-07-11 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale', 'KNOCKOUT'),

-- Dimanche 12 juillet
('Argentine', 'Suisse',     '2026-07-12 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale', 'KNOCKOUT');
