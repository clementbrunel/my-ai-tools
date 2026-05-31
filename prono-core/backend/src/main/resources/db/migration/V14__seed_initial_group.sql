-- V14__seed_initial_group.sql — Initial group + Clément as PLATFORM_ADMIN + GROUP_ADMIN

-- Promote Clément to PLATFORM_ADMIN
UPDATE users SET role = 'PLATFORM_ADMIN' WHERE username = 'clement';

-- Create the initial group (clement id=14 in V2 seed)
INSERT INTO groups (name, description, invite_code, created_by)
VALUES ('Les Potes', 'Le groupe original des amis', 'POTES2026', 14);
-- group id = 1

-- Add all 14 existing users to the initial group
-- clement = GROUP_ADMIN, everyone else = MEMBER
INSERT INTO group_members (group_id, user_id, role) VALUES
(1,  1,  'MEMBER'),   -- adrien
(1,  2,  'MEMBER'),   -- baptiste
(1,  3,  'MEMBER'),   -- christophe
(1,  4,  'MEMBER'),   -- damien
(1,  5,  'MEMBER'),   -- geoffrey
(1,  6,  'MEMBER'),   -- jeffrey
(1,  7,  'MEMBER'),   -- matheo
(1,  8,  'MEMBER'),   -- mickael
(1,  9,  'MEMBER'),   -- nicolasd
(1, 10,  'MEMBER'),   -- nicolasr
(1, 11,  'MEMBER'),   -- pierre
(1, 12,  'MEMBER'),   -- thomas
(1, 13,  'MEMBER'),   -- zacharie
(1, 14,  'GROUP_ADMIN'); -- clement

-- Seed group forfeits for the initial group (migrate from global forfeits)
INSERT INTO group_forfeits (group_id, title, description, category, is_active, times_completed) VALUES
(1, '🥐 Ramener les croissants',       'Le perdant apporte les croissants pour tout le groupe lors de la prochaine soirée.',                        'Nourriture',      TRUE, 0),
(1, '📸 Photo ridicule imposée',        'Porter le maillot de l''équipe adverse et poster une photo sur le groupe WhatsApp.',                         'Humiliation',     TRUE, 0),
(1, '🎤 Chanter l''hymne adverse',      'Enregistrer une vidéo en chantant l''hymne de l''équipe adverse et l''envoyer dans le groupe.',              'Spectacle',       TRUE, 0),
(1, '🖼️ Changer sa photo de profil',   'Mettre une photo honteuse en photo de profil pendant 48h. Pas d''excuses.',                                  'Réseaux sociaux', TRUE, 0),
(1, '👕 Porter un maillot honteux',     'Porter le maillot d''une équipe adverse pendant une journée entière, y compris au travail.',                 'Humiliation',     TRUE, 0),
(1, '🎬 Vidéo gênante',                 'Se filmer en train de célébrer un but adverse et envoyer la vidéo dans le groupe.',                          'Spectacle',       TRUE, 0),
(1, '🍺 Payer la tournée',              'Le perdant offre une tournée de boissons (soft ou alcool, au choix de chacun).',                             'Boissons',        TRUE, 0),
(1, '💬 Message honteux',               'Envoyer un message de soutien à l''équipe adverse dans le groupe famille ou collègues.',                     'Réseaux sociaux', TRUE, 0),
(1, '🕺 La danse de la victoire',       'Faire la danse de la victoire de l''équipe gagnante en vidéo et l''envoyer dans le groupe.',                 'Spectacle',       TRUE, 0),
(1, '🗣️ Blague nulle obligatoire',      'Raconter une blague nulle sur le foot lors de la prochaine réunion ou apéro avec le groupe.',               'Humiliation',     TRUE, 0),
(1, '🤳 Selfie avec un inconnu',        'Se prendre en photo avec un inconnu en portant des couleurs de l''équipe adverse.',                          'Humiliation',     TRUE, 0),
(1, '📢 Cri de victoire en public',     'Pousser un cri de victoire pour l''équipe adverse dans un lieu public (centre commercial, etc.).',          'Spectacle',       TRUE, 0);

-- Scope all existing bets to the initial group
UPDATE bets SET group_id = 1 WHERE group_id IS NULL;

-- Scope all existing daily_gages to the initial group
UPDATE daily_gages SET group_id = 1 WHERE group_id IS NULL;
