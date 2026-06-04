-- V2__demo_data.sql
-- World Cup 2026 — users, forfeits, all 72 group stage matches
-- All users share the same bcrypt password hash (rounds=10)

-- ============================================================
-- USERS
-- ============================================================
INSERT INTO users (username, email, password, role, global_score, bets_won, forfeits_received) VALUES
('adrien',     'adrien@pronocore.com',     'PLACEHOLDER', 'USER',  10, 0, 0),
('baptiste',   'baptiste@pronocore.com',   'PLACEHOLDER', 'USER',  10, 0, 0),
('christophe', 'christophe@pronocore.com', 'PLACEHOLDER', 'USER',  10, 0, 0),
('damien',     'damien@pronocore.com',     'PLACEHOLDER', 'USER',  10, 0, 0),
('geoffrey',   'geoffrey@pronocore.com',   'PLACEHOLDER', 'USER',  10, 0, 0),
('jeffrey',    'jeffrey@pronocore.com',    'PLACEHOLDER', 'USER',  10, 0, 0),
('matheo',     'matheo@pronocore.com',     'PLACEHOLDER', 'USER',  10, 0, 0),
('mickael',    'mickael@pronocore.com',    'PLACEHOLDER', 'USER',  10, 0, 0),
('nicolasd',   'nicolasd@pronocore.com',   'PLACEHOLDER', 'USER',  10, 0, 0),
('nicolasr',   'nicolasr@pronocore.com',   'PLACEHOLDER', 'USER',  10, 0, 0),
('pierre',     'pierre@pronocore.com',     'PLACEHOLDER', 'USER',  10, 0, 0),
('thomas',     'thomas@pronocore.com',     'PLACEHOLDER', 'USER',  10, 0, 0),
('zacharie',   'zacharie@pronocore.com',   'PLACEHOLDER', 'USER',  10, 0, 0),
('clement',    'clement@pronocore.com',    'PLACEHOLDER', 'ADMIN', 10, 0, 0);
-- IDs: adrien=1, baptiste=2, christophe=3, damien=4, geoffrey=5, jeffrey=6,
--      matheo=7, mickael=8, nicolasd=9, nicolasr=10, pierre=11, thomas=12,
--      zacharie=13, clement=14

-- ============================================================
-- FORFEITS (bibliothèque de gages)
-- ============================================================
INSERT INTO forfeits (title, description, category, is_active) VALUES
('🥐 Ramener les croissants',       'Le perdant apporte les croissants pour tout le groupe lors de la prochaine soirée.',                                                'Nourriture',      TRUE),
('📸 Photo ridicule imposée',        'Porter le maillot de l''équipe adverse et poster une photo sur le groupe WhatsApp.',                                               'Humiliation',     TRUE),
('🎤 Chanter l''hymne adverse',      'Enregistrer une vidéo en chantant l''hymne de l''équipe adverse et l''envoyer dans le groupe.',                                    'Spectacle',       TRUE),
('🖼️ Changer sa photo de profil',   'Mettre une photo honteuse en photo de profil pendant 48h. Pas d''excuses.',                                                        'Réseaux sociaux', TRUE),
('🎬 Vidéo gênante',                 'Se filmer en train de célébrer un but adverse et envoyer la vidéo dans le groupe.',                                                'Spectacle',       TRUE),
('🍺 Payer la tournée',              'Le perdant offre une tournée de boissons (soft ou alcool, au choix de chacun).',                                                   'Boissons',        TRUE),
('🗣️ Blague nulle obligatoire',      'Raconter une blague nulle sur le foot lors de la prochaine réunion ou apéro avec le groupe.',                                     'Humiliation',     TRUE),
('☕ Payer le café du bureau',        'Le perdant offre le café (ou thé, jus) à toute l''équipe au bureau le lendemain matin.',                                          'Nourriture',      TRUE),
('🖥️ Fond d''écran honteux',         'Mettre une photo de l''équipe adverse en fond d''écran de son ordinateur au bureau pendant 1 journée entière.',                   'Humiliation',     TRUE),
('📝 Signature mail honteuse',        'Ajouter "Supporter honteux de [équipe adverse]" dans sa signature email professionnelle pendant 24h.',                            'Réseaux sociaux', TRUE),
('🎙️ Discours de défaite',           'Enregistrer un message vocal de 30 secondes faisant l''éloge de l''équipe gagnante et l''envoyer dans le groupe.',                'Spectacle',       TRUE),
('🗳️ Compliment forcé',              'Envoyer un message dans le groupe listant 3 raisons pour lesquelles l''équipe adverse méritait de gagner.',                       'Humiliation',     TRUE),
('📊 Slide de la honte',             'Créer une diapositive "Les 3 qualités de l''équipe adverse" et la partager dans le groupe.',                                      'Spectacle',       TRUE),
('🏅 Photo de profil adverse',        'Mettre en photo de profil WhatsApp (ou autre réseau) le logo de l''équipe gagnante pendant 48h.',                                 'Réseaux sociaux', TRUE),
('🧠 Quiz foot raté',                 'Répondre à 5 questions sur l''histoire de l''équipe adverse posées par les autres membres, en direct dans le groupe.',            'Humiliation',     TRUE);
-- IDs: 1=croissants, 2=photo ridicule, 3=hymne, 4=photo profil, 5=vidéo,
--      6=tournée, 7=blague, 8=café bureau, 9=fond écran, 10=signature mail,
--      11=discours défaite, 12=compliment forcé, 13=slide honte, 14=photo profil adverse, 15=quiz

-- ============================================================
-- MATCHES — Phase de Groupes FIFA World Cup 2026
-- Groupes:
--   A: Mexique, Corée du Sud, Afrique du Sud, République Tchèque
--   B: Suisse, Canada, Bosnie-Herzégovine, Qatar
--   C: États-Unis, Australie, Turquie, Paraguay
--   D: Brésil, Haïti, Écosse, Maroc
--   E: Allemagne, Curaçao, Côte d'Ivoire, Équateur
--   F: Pays-Bas, Japon, Suède, Tunisie
--   G: Espagne, Cap-Vert, Arabie Saoudite, Uruguay
--   H: Belgique, Égypte, Iran, Nouvelle-Zélande
--   I: Angleterre, Croatie, Ghana, Panama
--   J: Portugal, Colombie, Ouzbékistan, RD Congo
--   K: Argentine, Algérie, Autriche, Jordanie
--   L: France, Sénégal, Irak, Norvège
-- ============================================================

-- ---------- JOURNÉE 1 ----------
INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round) VALUES
('Mexique',           'Afrique du Sud',    '2026-06-11 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 1'),
('Corée du Sud',      'République Tchèque','2026-06-12 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 1'),
('Canada',            'Bosnie-Herzégovine','2026-06-12 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 1'),
('États-Unis',        'Paraguay',          '2026-06-13 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 1'),
('Qatar',             'Suisse',            '2026-06-13 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 1'),
('Brésil',            'Maroc',             '2026-06-14 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 1'),
('Haïti',             'Écosse',            '2026-06-14 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 1'),
('Australie',         'Turquie',           '2026-06-14 06:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 1'),
('Allemagne',         'Curaçao',           '2026-06-14 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 1'),
('Pays-Bas',          'Japon',             '2026-06-14 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 1'),
('Côte d''Ivoire',    'Équateur',          '2026-06-15 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 1'),
('Suède',             'Tunisie',           '2026-06-15 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 1'),
('Espagne',           'Cap-Vert',          '2026-06-15 18:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 1'),
('Belgique',          'Égypte',            '2026-06-15 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 1'),
('Arabie Saoudite',   'Uruguay',           '2026-06-16 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 1'),
('Iran',              'Nouvelle-Zélande',  '2026-06-16 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 1'),
('France',            'Sénégal',           '2026-06-16 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 1'),
('Irak',              'Norvège',           '2026-06-17 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 1'),
('Argentine',         'Algérie',           '2026-06-17 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 1'),
('Autriche',          'Jordanie',          '2026-06-17 06:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 1'),
('Portugal',          'RD Congo',          '2026-06-17 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 1'),
('Angleterre',        'Croatie',           '2026-06-17 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 1'),
('Ghana',             'Panama',            '2026-06-18 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 1'),
('Ouzbékistan',       'Colombie',          '2026-06-18 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 1');

-- ---------- JOURNÉE 2 ----------
INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round) VALUES
('République Tchèque','Afrique du Sud',    '2026-06-18 18:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 2'),
('Suisse',            'Bosnie-Herzégovine','2026-06-18 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 2'),
('Canada',            'Qatar',             '2026-06-19 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 2'),
('Mexique',           'Corée du Sud',      '2026-06-19 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 2'),
('États-Unis',        'Australie',         '2026-06-19 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 2'),
('Écosse',            'Maroc',             '2026-06-20 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 2'),
('Brésil',            'Haïti',             '2026-06-20 02:30:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 2'),
('Turquie',           'Paraguay',          '2026-06-20 05:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 2'),
('Pays-Bas',          'Suède',             '2026-06-20 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 2'),
('Allemagne',         'Côte d''Ivoire',    '2026-06-20 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 2'),
('Équateur',          'Curaçao',           '2026-06-21 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 2'),
('Tunisie',           'Japon',             '2026-06-21 06:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 2'),
('Espagne',           'Arabie Saoudite',   '2026-06-21 18:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 2'),
('Belgique',          'Iran',              '2026-06-21 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 2'),
('Uruguay',           'Cap-Vert',          '2026-06-22 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 2'),
('Nouvelle-Zélande',  'Égypte',            '2026-06-22 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 2'),
('Argentine',         'Autriche',          '2026-06-22 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 2'),
('France',            'Irak',              '2026-06-22 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 2'),
('Norvège',           'Sénégal',           '2026-06-23 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 2'),
('Jordanie',          'Algérie',           '2026-06-23 05:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 2'),
('Portugal',          'Ouzbékistan',       '2026-06-23 19:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 2'),
('Angleterre',        'Ghana',             '2026-06-23 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 2'),
('Panama',            'Croatie',           '2026-06-24 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 2'),
('Colombie',          'RD Congo',          '2026-06-24 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 2');

-- ---------- JOURNÉE 3 (simultanée dans chaque groupe) ----------
INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round) VALUES
('Bosnie-Herzégovine','Qatar',             '2026-06-24 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 3'),
('Suisse',            'Canada',            '2026-06-24 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe B - Journée 3'),
('Écosse',            'Brésil',            '2026-06-25 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 3'),
('Maroc',             'Haïti',             '2026-06-25 00:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe D - Journée 3'),
('Afrique du Sud',    'Corée du Sud',      '2026-06-25 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 3'),
('République Tchèque','Mexique',           '2026-06-25 03:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe A - Journée 3'),
('Curaçao',           'Côte d''Ivoire',    '2026-06-25 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 3'),
('Équateur',          'Allemagne',         '2026-06-25 22:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe E - Journée 3'),
('Japon',             'Suède',             '2026-06-26 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 3'),
('Tunisie',           'Pays-Bas',          '2026-06-26 01:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe F - Journée 3'),
('Paraguay',          'Australie',         '2026-06-26 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 3'),
('Turquie',           'États-Unis',        '2026-06-26 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe C - Journée 3'),
('Norvège',           'France',            '2026-06-26 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 3'),
('Sénégal',           'Irak',              '2026-06-26 21:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe L - Journée 3'),
('Cap-Vert',          'Arabie Saoudite',   '2026-06-27 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 3'),
('Uruguay',           'Espagne',           '2026-06-27 02:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe G - Journée 3'),
('Égypte',            'Iran',              '2026-06-27 05:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 3'),
('Nouvelle-Zélande',  'Belgique',          '2026-06-27 05:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe H - Journée 3'),
('Croatie',           'Ghana',             '2026-06-27 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 3'),
('Panama',            'Angleterre',        '2026-06-27 23:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe I - Journée 3'),
('Colombie',          'Portugal',          '2026-06-28 01:30:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 3'),
('RD Congo',          'Ouzbékistan',       '2026-06-28 01:30:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe J - Journée 3'),
('Algérie',           'Autriche',          '2026-06-28 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 3'),
('Jordanie',          'Argentine',         '2026-06-28 04:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Groupe K - Journée 3');
-- Total: 72 matches (24 per matchday × 3 matchdays)
