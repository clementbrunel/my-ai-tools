-- V42__quarter_final_matches.sql
-- FIFA World Cup 2026 — 4 matchs des quarts de finale
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les 8es de finale.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)
-- Ecrit apres V41 (matches_team_fk) et V40 (matches_competition_fk) : team_a/team_b et competition
-- n'existent plus, on renseigne directement team_a_id/team_b_id/competition_id via lookup.

INSERT INTO matches (team_a_id, team_b_id, match_date, score_a, score_b, status, competition_id, round, phase)
SELECT ta.id, tb.id, v.match_date, NULL, NULL, 'UPCOMING', c.id, v.round, 'KNOCKOUT'
FROM (VALUES

-- Mercredi 8 juillet
('France',    'Maroc',      '2026-07-08 22:00:00'::timestamp, 'Quart de finale'),

-- Vendredi 10 juillet
('Espagne',   'Belgique',   '2026-07-10 21:00:00'::timestamp, 'Quart de finale'),

-- Samedi 11 juillet
('Norvège',   'Angleterre', '2026-07-11 23:00:00'::timestamp, 'Quart de finale'),

-- Dimanche 12 juillet
('Argentine', 'Suisse',     '2026-07-12 03:00:00'::timestamp, 'Quart de finale')

) AS v(team_a, team_b, match_date, round)
JOIN teams ta ON ta.name = v.team_a
JOIN teams tb ON tb.name = v.team_b
JOIN competitions c ON c.name = 'FIFA World Cup 2026';
