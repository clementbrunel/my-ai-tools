-- V5__sample_bets.sql
-- Sample score bets on Matchday 1 matches.
-- chosenOption format: "Victoire [team] [score_a]-[score_b]"  or  "Match nul [score_a]-[score_b]"
-- creator_id = 14 (clement, ADMIN)
--
-- Match IDs (from V2 insertion order):
--   6  = Brésil vs Maroc          (14.06 00:00)
--   9  = Allemagne vs Curaçao      (14.06 19:00)
--  13  = Espagne vs Cap-Vert       (15.06 18:00)
--  17  = France vs Sénégal         (16.06 21:00)
--  19  = Argentine vs Algérie      (17.06 03:00)
--  22  = Angleterre vs Croatie     (17.06 22:00)
--
-- Forfeit IDs (from V2):
--   1 = Croissants   2 = Photo ridicule   3 = Hymne adverse   4 = Photo profil

-- ============================================================
-- BETS
-- ============================================================
INSERT INTO bets (title, description, match_id, creator_id, bet_type, points, deadline, status, forfeit_id) VALUES
(
  '🇧🇷 Prono Brésil vs Maroc — J1',
  'Votre pronostic pour le score exact du match Brésil vs Maroc. Gage en cas de mauvais résultat !',
  6, 14, 'SCORE', 20, '2026-06-13 23:00:00', 'OPEN', 2
),
(
  '🇩🇪 Prono Allemagne vs Curaçao — J1',
  'Quel score pour l''Allemagne face à Curaçao ? Changement de photo de profil pour les perdants.',
  9, 14, 'SCORE', 15, '2026-06-14 18:00:00', 'OPEN', 4
),
(
  '🇪🇸 Prono Espagne vs Cap-Vert — J1',
  'L''Espagne dominera-t-elle ? Donnez votre pronostic exact.',
  13, 14, 'SCORE', 15, '2026-06-15 17:00:00', 'OPEN', NULL
),
(
  '🇫🇷 Prono France vs Sénégal — J1',
  'Le match des Bleus ! Croissants pour tout le groupe si tu te plantes.',
  17, 14, 'SCORE', 25, '2026-06-16 20:00:00', 'OPEN', 1
),
(
  '🇦🇷 Prono Argentine vs Algérie — J1',
  'L''Albiceleste face aux Fennecs. Chanter l''hymne adverse en vidéo pour les perdants !',
  19, 14, 'SCORE', 20, '2026-06-17 02:00:00', 'OPEN', 3
),
(
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Prono Angleterre vs Croatie — J1',
  'Revanche de 2018 ? Pronostique le score exact. Aucun gage cette fois, juste la fierté.',
  22, 14, 'SCORE', 20, '2026-06-17 21:00:00', 'OPEN', NULL
);
-- Bet IDs: 1=Brésil-Maroc, 2=All-Cur, 3=Esp-Cap, 4=France-Sénégal, 5=Arg-Alg, 6=Ang-Cro

-- ============================================================
-- PARTICIPATIONS
-- ============================================================

-- Bet 1 — Brésil vs Maroc
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(1,  1, 'Victoire Brésil 3-0',  'Brésil trop fort en phase de groupes 🇧🇷'),
(1,  2, 'Victoire Brésil 2-1',  'Maroc va accrocher mais ça passe quand même'),
(1,  9, 'Match nul 1-1',        'Surprise possible, le Maroc est solide défensivement'),
(1, 10, 'Victoire Brésil 3-1',  'Le Brésil va s''amuser !'),
(1, 11, 'Victoire Maroc 1-0',   'Je mise sur la surprise africaine 🌍'),
(1, 12, 'Victoire Brésil 2-0',  NULL),
(1, 13, 'Victoire Brésil 4-0',  'Le Brésil va humilier !');

-- Bet 2 — Allemagne vs Curaçao
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(2,  3, 'Victoire Allemagne 4-0', 'Curaçao n''a rien à faire là'),
(2,  4, 'Victoire Allemagne 3-0', 'Écrasant mais sans forcer'),
(2,  5, 'Victoire Allemagne 5-1', 'Festival de buts côté allemand 💥'),
(2,  6, 'Victoire Allemagne 3-1', NULL),
(2,  7, 'Match nul 1-1',          'Attention à la surprise, allez 😅'),
(2,  8, 'Victoire Allemagne 2-0', 'Allemagne sérieuse mais pas folle'),
(2, 14, 'Victoire Allemagne 4-1', 'Curaçao au niveau de certains matchs de Ligue 1 😂');

-- Bet 3 — Espagne vs Cap-Vert
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(3,  1, 'Victoire Espagne 3-0',  NULL),
(3,  2, 'Victoire Espagne 2-0',  'L''Espagne garde le zéro facilement'),
(3, 12, 'Victoire Espagne 4-0',  'Tiki-taka mortel 🔴'),
(3, 13, 'Match nul 0-0',         'Cap-Vert va défendre bas, match chiant'),
(3,  3, 'Victoire Espagne 1-0',  'Victoire courte mais assurée');

-- Bet 4 — France vs Sénégal
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(4,  1, 'Victoire France 2-0',   'Les Bleus solides en défense 🇫🇷'),
(4,  2, 'Victoire France 1-0',   'Victoire étriquée mais ça suffit'),
(4,  3, 'Match nul 1-1',         'Le Sénégal est capable de tenir'),
(4,  4, 'Victoire France 3-1',   'Mbappé va faire le show !'),
(4,  5, 'Victoire Sénégal 1-0',  'Le Sénégal va faire la sensation 🦁'),
(4,  6, 'Victoire France 2-1',   'Victoire au finish'),
(4,  7, 'Match nul 0-0',         'Match tactique nul et nul 😴'),
(4,  8, 'Victoire France 1-0',   'France mais c''est dur');

-- Bet 5 — Argentine vs Algérie
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(5, 14, 'Victoire Argentine 3-0', 'Messi en mode finale de coupe du monde 🐐'),
(5,  1, 'Victoire Argentine 2-0', 'L''Argentine trop forte collectivement'),
(5,  2, 'Victoire Argentine 2-1', 'L''Algérie va faire un but mais perdre'),
(5,  9, 'Victoire Algérie 1-0',   'On va tous se souvenir de ce jour 🟢⬜🔴'),
(5, 10, 'Match nul 1-1',          'Surprenamment accroché'),
(5, 11, 'Victoire Argentine 3-1', 'Argentine dominatrice');

-- Bet 6 — Angleterre vs Croatie
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(6,  6, 'Victoire Angleterre 2-1', 'Football is coming home... enfin peut-être'),
(6,  7, 'Match nul 1-1',           'La Croatie sait jouer les gros matchs'),
(6,  8, 'Victoire Angleterre 1-0', 'Victoire anglaise sobre'),
(6,  9, 'Victoire Croatie 2-1',    'Croatie revancharde depuis 2018 !'),
(6, 10, 'Victoire Angleterre 3-0', 'Angleterre en démonstration'),
(6, 11, 'Victoire Angleterre 2-0', NULL);
