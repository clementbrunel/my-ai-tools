-- V38__round_of_16_matches.sql
-- FIFA World Cup 2026 — 8 matchs des 8es de finale
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les 16es de finale.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)

INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round, phase) VALUES

-- Samedi 4 juillet
('Canada',      'Maroc',       '2026-07-04 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),
('Paraguay',    'France',      '2026-07-04 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),

-- Dimanche 5 juillet
('Brésil',      'Norvège',     '2026-07-05 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),

-- Lundi 6 juillet
('Mexique',     'Angleterre',  '2026-07-06 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),
('Portugal',    'Espagne',     '2026-07-06 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),

-- Mardi 7 juillet
('États-Unis',  'Belgique',    '2026-07-07 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),
('Argentine',   'Égypte',      '2026-07-07 18:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT'),
('Suisse',      'Colombie',    '2026-07-07 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '8e de finale', 'KNOCKOUT');
