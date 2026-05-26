-- V2__demo_data.sql - Demo data for World Cup 2026

-- Admin user (password: admin123)
INSERT INTO users (username, email, password, role, global_score, bets_won, forfeits_received) VALUES
('admin', 'admin@pronocore.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt9g0xa', 'ADMIN', 250, 12, 0);

-- Regular users (password: demo123)
INSERT INTO users (username, email, password, role, global_score, bets_won, forfeits_received) VALUES
('demo', 'demo@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 180, 8, 2),
('lucas', 'lucas@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 220, 11, 1),
('marie', 'marie@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 95, 4, 5),
('thomas', 'thomas@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 310, 15, 0),
('sophie', 'sophie@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 140, 6, 3),
('pierre', 'pierre@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 75, 3, 7),
('julie', 'julie@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 195, 9, 1),
('maxime', 'maxime@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 160, 7, 2),
('camille', 'camille@pronocore.com', '$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ3G2', 'USER', 50, 2, 8);

-- World Cup 2026 matches
INSERT INTO matches (team_a, team_b, match_date, score_a, score_b, status, competition, round) VALUES
('France', 'Brésil', '2026-06-15 20:00:00', 2, 1, 'FINISHED', 'FIFA World Cup 2026', 'Quart de finale'),
('Argentine', 'Angleterre', '2026-06-16 17:00:00', 1, 1, 'FINISHED', 'FIFA World Cup 2026', 'Quart de finale'),
('Espagne', 'Portugal', '2026-06-17 20:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Demi-finale'),
('Allemagne', 'Maroc', '2026-06-18 17:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Demi-finale'),
('France', 'Argentine', '2026-06-22 20:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Finale'),
('Pays-Bas', 'Croatie', '2026-06-14 14:00:00', 3, 2, 'FINISHED', 'FIFA World Cup 2026', 'Huitième de finale'),
('USA', 'Mexique', '2026-06-13 20:00:00', 2, 0, 'FINISHED', 'FIFA World Cup 2026', 'Huitième de finale'),
('Japon', 'Corée du Sud', '2026-06-19 14:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale'),
('Sénégal', 'Côte d''Ivoire', '2026-06-20 17:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Quart de finale'),
('Espagne', 'Angleterre', '2026-06-23 20:00:00', NULL, NULL, 'UPCOMING', 'FIFA World Cup 2026', 'Match pour la 3ème place');

-- Forfeits (fun forfeits for the loser)
INSERT INTO forfeits (title, description, category, is_active) VALUES
('Porter le maillot adverse', 'Porter le maillot de l''équipe adverse pendant toute une journée', 'Humiliation', TRUE),
('Chanter l''hymne national', 'Chanter l''hymne de l''équipe gagnante devant tout le groupe', 'Spectacle', TRUE),
('Photo ridicule', 'Prendre une photo ridicule avec une cape de superhéros et la poster sur le groupe', 'Réseaux sociaux', TRUE),
('Payer une tournée', 'Offrir une tournée de boissons à tout le groupe', 'Boissons', TRUE),
('Maquillage aux couleurs adverses', 'Venir au prochain match maquillé aux couleurs de l''équipe qui a gagné', 'Maquillage', TRUE),
('Chant de défaite', 'Composer et chanter une chanson sur sa défaite devant le groupe', 'Spectacle', TRUE),
('Surnom pour une semaine', 'Accepter un surnom humiliant choisi par le groupe pendant 7 jours', 'Humiliation', TRUE),
('Défi culinaire', 'Cuisiner le plat traditionnel du pays gagnant pour tout le groupe', 'Cuisine', TRUE),
('Confessions publiques', 'Révéler le score qu''on avait pronostiqué en story Instagram', 'Réseaux sociaux', TRUE),
('Faire la vaiselle', 'Faire la vaisselle après le prochain repas de groupe', 'Corvée', TRUE),
('Vidéo de soutien', 'Enregistrer une vidéo de soutien pour l''équipe adverse et la partager', 'Réseaux sociaux', TRUE),
('Tatouage temporaire', 'Porter un tatouage temporaire du drapeau du pays gagnant pendant 3 jours', 'Humiliation', TRUE);

-- Demo bets
INSERT INTO bets (title, description, match_id, creator_id, bet_type, points, deadline, status, winning_option) VALUES
('Score exact France-Brésil', 'Pronostiquez le score exact du match France vs Brésil', 1, 1, 'SCORE', 20, '2026-06-15 19:00:00', 'VALIDATED', '2-1'),
('Premier buteur France-Brésil', 'Qui marquera le premier but du match ?', 1, 2, 'EVENT', 15, '2026-06-15 19:00:00', 'VALIDATED', 'Mbappé'),
('France passera-t-elle en finale ?', 'La France va-t-elle atteindre la finale ?', 1, 3, 'FREE', 10, '2026-06-15 19:00:00', 'VALIDATED', 'Oui'),
('Score exact Argentine-Angleterre', 'Pronostiquez le score exact', 2, 1, 'SCORE', 20, '2026-06-16 16:00:00', 'VALIDATED', '1-1'),
('Score exact Espagne-Portugal', 'El Clasico ibérique ! Qui va gagner ?', 3, 4, 'SCORE', 25, '2026-06-17 19:00:00', 'OPEN', NULL),
('Nombre de buts Espagne-Portugal', 'Combien de buts au total dans ce match ?', 3, 5, 'EVENT', 15, '2026-06-17 19:00:00', 'OPEN', NULL),
('Vainqueur de la finale', 'Qui va gagner la Coupe du Monde 2026 ?', 5, 1, 'FREE', 50, '2026-06-22 19:00:00', 'OPEN', NULL),
('Score exact Allemagne-Maroc', 'L''Allemagne dominera-t-elle le Maroc ?', 4, 2, 'SCORE', 20, '2026-06-18 16:00:00', 'OPEN', NULL);

-- Demo participations
INSERT INTO bet_participations (bet_id, user_id, chosen_option, comment) VALUES
(1, 2, '2-1', 'Les Bleus sont trop forts !'),
(1, 3, '3-2', 'Match serré en vue'),
(1, 4, '1-0', 'Défense béton française'),
(1, 5, '2-0', 'Mbappé va tout déchirer'),
(2, 2, 'Mbappé', 'Classique !'),
(2, 3, 'Vinicius Jr', 'Le Brésil attaque fort'),
(2, 4, 'Mbappé', 'Il est en feu en ce moment'),
(3, 2, 'Oui', 'Allez les Bleus !'),
(3, 3, 'Oui', '100% finale'),
(3, 4, 'Non', 'Le Brésil va les éliminer'),
(4, 2, '1-1', 'Match nul, puis tirs au but'),
(4, 3, '2-1', 'L''Argentine est plus forte'),
(5, 2, '2-1', 'Espagne favorite'),
(5, 3, '1-0', 'Ronaldo décidera'),
(5, 4, '1-1', 'Match équilibré'),
(6, 2, '3 buts', 'Match offensif'),
(6, 3, '2 buts', 'Les défenses sont solides'),
(7, 2, 'France', 'Allez les Bleus 🇫🇷'),
(7, 3, 'Argentine', 'Messi a soif de revanche'),
(7, 4, 'France', 'On est les meilleurs'),
(7, 5, 'Espagne', 'L''Espagne va tout gagner'),
(8, 2, '2-0', 'Allemagne trop forte'),
(8, 3, '1-1', 'Maroc surprise !');

-- Assign some forfeits
INSERT INTO user_forfeits (user_id, forfeit_id, assigned_by_id, bet_id, is_completed, assigned_at) VALUES
(4, 1, 1, 1, FALSE, NOW() - INTERVAL '2 days'),
(4, 3, 2, 3, FALSE, NOW() - INTERVAL '1 day'),
(2, 4, 1, 4, TRUE, NOW() - INTERVAL '3 days'),
(6, 7, 1, 1, FALSE, NOW() - INTERVAL '2 days'),
(9, 2, 1, 1, FALSE, NOW() - INTERVAL '1 day'),
(10, 5, 3, 2, FALSE, NOW());
