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
(1, '🥐 Ramener les croissants',       'Le perdant apporte les croissants pour tout le groupe lors de la prochaine soirée.',                                                'Nourriture',      TRUE, 0),
(1, '📸 Photo ridicule imposée',        'Porter le maillot de l''équipe adverse et poster une photo sur le groupe WhatsApp.',                                               'Humiliation',     TRUE, 0),
(1, '🎤 Chanter l''hymne adverse',      'Enregistrer une vidéo en chantant l''hymne de l''équipe adverse et l''envoyer dans le groupe.',                                    'Spectacle',       TRUE, 0),
(1, '🖼️ Changer sa photo de profil',   'Mettre une photo honteuse en photo de profil pendant 48h. Pas d''excuses.',                                                        'Réseaux sociaux', TRUE, 0),
(1, '🎬 Vidéo gênante',                 'Se filmer en train de célébrer un but adverse et envoyer la vidéo dans le groupe.',                                                'Spectacle',       TRUE, 0),
(1, '🍺 Payer la tournée',              'Le perdant offre une tournée de boissons (soft ou alcool, au choix de chacun).',                                                   'Boissons',        TRUE, 0),
(1, '🗣️ Blague nulle obligatoire',      'Raconter une blague nulle sur le foot lors de la prochaine réunion ou apéro avec le groupe.',                                     'Humiliation',     TRUE, 0),
(1, '☕ Payer le café du bureau',        'Le perdant offre le café (ou thé, jus) à toute l''équipe au bureau le lendemain matin.',                                          'Nourriture',      TRUE, 0),
(1, '🖥️ Fond d''écran honteux',         'Mettre une photo de l''équipe adverse en fond d''écran de son ordinateur au bureau pendant 1 journée entière.',                   'Humiliation',     TRUE, 0),
(1, '📝 Signature mail honteuse',        'Ajouter "Supporter honteux de [équipe adverse]" dans sa signature email professionnelle pendant 24h.',                            'Réseaux sociaux', TRUE, 0),
(1, '🎙️ Discours de défaite',           'Enregistrer un message vocal de 30 secondes faisant l''éloge de l''équipe gagnante et l''envoyer dans le groupe.',                'Spectacle',       TRUE, 0),
(1, '🗳️ Compliment forcé',              'Envoyer un message dans le groupe listant 3 raisons pour lesquelles l''équipe adverse méritait de gagner.',                       'Humiliation',     TRUE, 0),
(1, '📊 Slide de la honte',             'Créer une diapositive "Les 3 qualités de l''équipe adverse" et la partager dans le groupe.',                                      'Spectacle',       TRUE, 0),
(1, '🏅 Photo de profil adverse',        'Mettre en photo de profil WhatsApp (ou autre réseau) le logo de l''équipe gagnante pendant 48h.',                                 'Réseaux sociaux', TRUE, 0),
(1, '🧠 Quiz foot raté',                 'Répondre à 5 questions sur l''histoire de l''équipe adverse posées par les autres membres, en direct dans le groupe.',            'Humiliation',     TRUE, 0);

-- Scope all existing bets to the initial group
UPDATE bets SET group_id = 1 WHERE group_id IS NULL;

-- Scope all existing daily_gages to the initial group
UPDATE daily_gages SET group_id = 1 WHERE group_id IS NULL;
