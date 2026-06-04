-- V5__sample_bets.sql
-- Assign forfeits + bettor_bonus to highlight Matchday 1 matches.
-- Then insert sample SCORE bets and participations.
--
-- chosenOption format: "Victoire [winner] [winnerScore]-[loserScore]"
--                   or "Match nul [scoreA]-[scoreB]"
-- Examples:
--   France (team_a) wins 2-1 → "Victoire France 2-1"
--   Sénégal (team_b) wins 1-0 → "Victoire Sénégal 1-0"   (winner score first)
--   Draw 0-0               → "Match nul 0-0"
--
-- creator_id = 1 (clement, ADMIN)
-- Match IDs (from V2 insertion order):
--   6=Brésil-Maroc  9=Allemagne-Curaçao  13=Espagne-Cap-Vert
--  17=France-Sénégal  19=Argentine-Algérie  22=Angleterre-Croatie

-- ============================================================
-- Assign gages & bettor bonus to matches
-- ============================================================
UPDATE matches SET forfeit_id = 2, bettor_bonus = 5 WHERE team_a = 'Brésil'     AND team_b = 'Maroc';
UPDATE matches SET forfeit_id = 4, bettor_bonus = 3 WHERE team_a = 'Allemagne'  AND team_b = 'Curaçao';
UPDATE matches SET forfeit_id = 1, bettor_bonus = 5 WHERE team_a = 'France'     AND team_b = 'Sénégal';
UPDATE matches SET forfeit_id = 3, bettor_bonus = 5 WHERE team_a = 'Argentine'  AND team_b = 'Algérie';
-- forfeit_id=1 croissants  2=photo ridicule  3=hymne  4=photo de profil

-- ============================================================
-- BETS (deadline = match kick-off time, copied from matches.match_date)
-- ============================================================
INSERT INTO bets (title, description, match_id, creator_id, bet_type, points, deadline, status)
SELECT
  title, description, match_id, 1, 'SCORE', points,
  (SELECT match_date FROM matches WHERE id = match_id),
  'OPEN'
FROM (VALUES
  ('🇧🇷 Prono Brésil vs Maroc — J1',
   'Votre pronostic pour le score exact. Photo ridicule pour le plus gros parieur qui se plante !',
   6, 20),
  ('🇩🇪 Prono Allemagne vs Curaçao — J1',
   'Quel score pour l''Allemagne face à Curaçao ? Le plus gros parieur perdant change sa photo de profil.',
   9, 15),
  ('🇪🇸 Prono Espagne vs Cap-Vert — J1',
   'L''Espagne dominera-t-elle ? Pronostique le score exact. Pas de gage sur ce match.',
   13, 15),
  ('🇫🇷 Prono France vs Sénégal — J1',
   'Le match des Bleus ! Le plus gros parieur qui se trompe ramène les croissants 🥐',
   17, 25),
  ('🇦🇷 Prono Argentine vs Algérie — J1',
   'L''Albiceleste face aux Fennecs. Le plus gros parieur perdant chante l''hymne adverse en vidéo !',
   19, 20),
  ('🏴󠁧󠁢󠁥󠁮󠁧󠁿 Prono Angleterre vs Croatie — J1',
   'Revanche de 2018 ? Pronostique le score exact. Juste la fierté en jeu.',
   22, 20)
) AS t(title, description, match_id, points);
-- Bet IDs: 1=Brésil-Maroc  2=All-Cur  3=Esp-Cap  4=France-Sén  5=Arg-Alg  6=Ang-Cro
