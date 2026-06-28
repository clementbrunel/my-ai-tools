-- V37__round_of_16_matches.sql
-- FIFA World Cup 2026 — 16 matchs des 16es de finale
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les matchs de poule.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)

INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round, phase) VALUES

-- Dimanche 28 juin
('Afrique du Sud',    'Canada',              '2026-06-28 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Lundi 29 juin
('Brésil',            'Japon',               '2026-06-29 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Allemagne',         'Paraguay',            '2026-06-29 22:30:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Mardi 30 juin
('Pays-Bas',          'Maroc',               '2026-06-30 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Côte d''Ivoire',    'Norvège',             '2026-06-30 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('France',            'Suède',               '2026-06-30 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Mercredi 1er juillet
('Mexique',           'Équateur',            '2026-07-01 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Angleterre',        'RD Congo',            '2026-07-01 18:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Belgique',          'Sénégal',             '2026-07-01 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Jeudi 2 juillet
('États-Unis',        'Bosnie-Herzégovine',  '2026-07-02 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Espagne',           'Autriche',            '2026-07-02 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Vendredi 3 juillet
('Portugal',          'Croatie',             '2026-07-03 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Suisse',            'Algérie',             '2026-07-03 05:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Australie',         'Égypte',              '2026-07-03 20:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),

-- Samedi 4 juillet
('Argentine',         'Cap-Vert',            '2026-07-04 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT'),
('Colombie',          'Ghana',               '2026-07-04 03:30:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', '16e de finale', 'KNOCKOUT');
