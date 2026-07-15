-- V50__third_place_and_final_matches.sql
-- FIFA World Cup 2026 — match pour la 3e place et finale
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les demi-finales.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)
-- Même schéma que V43 : team_a_id/team_b_id/competition_id renseignés via lookup.

INSERT INTO matches (team_a_id, team_b_id, match_date, score_a, score_b, status, competition_id, round, phase)
SELECT ta.id, tb.id, v.match_date, NULL, NULL, 'UPCOMING', c.id, v.round, 'KNOCKOUT'
FROM (VALUES

-- Samedi 18 juillet
('France',    'Angleterre', '2026-07-18 23:00:00'::timestamp, 'Petite finale'),

-- Dimanche 19 juillet
('Espagne',   'Argentine',  '2026-07-19 21:00:00'::timestamp, 'Finale')

) AS v(team_a, team_b, match_date, round)
JOIN teams ta ON ta.name = v.team_a
JOIN teams tb ON tb.name = v.team_b
JOIN competitions c ON c.name = 'FIFA World Cup 2026';
