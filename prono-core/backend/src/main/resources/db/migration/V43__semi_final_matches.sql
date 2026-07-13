-- V43__semi_final_matches.sql
-- FIFA World Cup 2026 — 2 matchs des demi-finales
-- Toutes les heures sont en heure de Paris (CEST = UTC+2), cohérent avec les quarts de finale.
-- phase = 'KNOCKOUT' (calcul tirs au but activé)
-- Même schéma que V42 : team_a_id/team_b_id/competition_id renseignés via lookup.

INSERT INTO matches (team_a_id, team_b_id, match_date, score_a, score_b, status, competition_id, round, phase)
SELECT ta.id, tb.id, v.match_date, NULL, NULL, 'UPCOMING', c.id, v.round, 'KNOCKOUT'
FROM (VALUES

-- Mardi 14 juillet
('France',     'Espagne',   '2026-07-14 21:00:00'::timestamp, 'Demi-finale'),

-- Mercredi 15 juillet
('Angleterre', 'Argentine', '2026-07-15 21:00:00'::timestamp, 'Demi-finale')

) AS v(team_a, team_b, match_date, round)
JOIN teams ta ON ta.name = v.team_a
JOIN teams tb ON tb.name = v.team_b
JOIN competitions c ON c.name = 'FIFA World Cup 2026';
