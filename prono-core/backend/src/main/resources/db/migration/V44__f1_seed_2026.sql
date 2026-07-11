-- V44__f1_seed_2026.sql — Saison F1 2026 : écuries, pilotes, calendrier.
--
-- Seed indicatif (grille et horaires approximatifs, heure de Paris) :
-- l'admin plateforme peut corriger en base (pgAdmin) ou via l'API admin.

INSERT INTO competitions (name, sport) VALUES ('Formule 1 2026', 'F1');

INSERT INTO constructors (name, color) VALUES
    ('McLaren',      '#FF8000'),
    ('Ferrari',      '#E8002D'),
    ('Red Bull',     '#3671C6'),
    ('Mercedes',     '#27F4D2'),
    ('Aston Martin', '#229971'),
    ('Alpine',       '#0093CC'),
    ('Haas',         '#B6BABD'),
    ('Racing Bulls', '#6692FF'),
    ('Williams',     '#64C4FF'),
    ('Audi',         '#BB0A30'),
    ('Cadillac',     '#D4AF37');

INSERT INTO drivers (name, code, number, constructor_id) VALUES
    ('Lando Norris',      'NOR',  4, (SELECT id FROM constructors WHERE name = 'McLaren')),
    ('Oscar Piastri',     'PIA', 81, (SELECT id FROM constructors WHERE name = 'McLaren')),
    ('Charles Leclerc',   'LEC', 16, (SELECT id FROM constructors WHERE name = 'Ferrari')),
    ('Lewis Hamilton',    'HAM', 44, (SELECT id FROM constructors WHERE name = 'Ferrari')),
    ('Max Verstappen',    'VER', 33, (SELECT id FROM constructors WHERE name = 'Red Bull')),
    ('Isack Hadjar',      'HAD',  6, (SELECT id FROM constructors WHERE name = 'Red Bull')),
    ('George Russell',    'RUS', 63, (SELECT id FROM constructors WHERE name = 'Mercedes')),
    ('Kimi Antonelli',    'ANT', 12, (SELECT id FROM constructors WHERE name = 'Mercedes')),
    ('Fernando Alonso',   'ALO', 14, (SELECT id FROM constructors WHERE name = 'Aston Martin')),
    ('Lance Stroll',      'STR', 18, (SELECT id FROM constructors WHERE name = 'Aston Martin')),
    ('Pierre Gasly',      'GAS', 10, (SELECT id FROM constructors WHERE name = 'Alpine')),
    ('Franco Colapinto',  'COL', 43, (SELECT id FROM constructors WHERE name = 'Alpine')),
    ('Esteban Ocon',      'OCO', 31, (SELECT id FROM constructors WHERE name = 'Haas')),
    ('Oliver Bearman',    'BEA', 87, (SELECT id FROM constructors WHERE name = 'Haas')),
    ('Liam Lawson',       'LAW', 30, (SELECT id FROM constructors WHERE name = 'Racing Bulls')),
    ('Arvid Lindblad',    'LIN', 41, (SELECT id FROM constructors WHERE name = 'Racing Bulls')),
    ('Alexander Albon',   'ALB', 23, (SELECT id FROM constructors WHERE name = 'Williams')),
    ('Carlos Sainz',      'SAI', 55, (SELECT id FROM constructors WHERE name = 'Williams')),
    ('Nico Hülkenberg',   'HUL', 27, (SELECT id FROM constructors WHERE name = 'Audi')),
    ('Gabriel Bortoleto', 'BOR',  5, (SELECT id FROM constructors WHERE name = 'Audi')),
    ('Sergio Pérez',      'PER', 11, (SELECT id FROM constructors WHERE name = 'Cadillac')),
    ('Valtteri Bottas',   'BOT', 77, (SELECT id FROM constructors WHERE name = 'Cadillac'));

INSERT INTO races (round, name, country_iso2, circuit, qualifying_date, race_date, competition_id)
SELECT r.round, r.name, r.iso2, r.circuit, r.quali::timestamp, r.race::timestamp,
       (SELECT id FROM competitions WHERE name = 'Formule 1 2026')
FROM (VALUES
    ( 1, 'GP d''Australie',        'AU', 'Albert Park, Melbourne',      '2026-03-07 06:00', '2026-03-08 05:00'),
    ( 2, 'GP de Chine',            'CN', 'Shanghai International',      '2026-03-14 08:00', '2026-03-15 08:00'),
    ( 3, 'GP du Japon',            'JP', 'Suzuka',                      '2026-03-28 07:00', '2026-03-29 07:00'),
    ( 4, 'GP de Bahreïn',          'BH', 'Sakhir',                      '2026-04-11 17:00', '2026-04-12 17:00'),
    ( 5, 'GP d''Arabie saoudite',  'SA', 'Jeddah Corniche',             '2026-04-18 19:00', '2026-04-19 19:00'),
    ( 6, 'GP de Miami',            'US', 'Miami International',         '2026-05-02 22:00', '2026-05-03 22:00'),
    ( 7, 'GP du Canada',           'CA', 'Gilles-Villeneuve, Montréal', '2026-05-23 22:00', '2026-05-24 20:00'),
    ( 8, 'GP de Monaco',           'MC', 'Monte-Carlo',                 '2026-06-06 16:00', '2026-06-07 15:00'),
    ( 9, 'GP d''Espagne',          'ES', 'Barcelona-Catalunya',         '2026-06-13 16:00', '2026-06-14 15:00'),
    (10, 'GP d''Autriche',         'AT', 'Red Bull Ring, Spielberg',    '2026-06-27 16:00', '2026-06-28 15:00'),
    (11, 'GP de Grande-Bretagne',  'GB', 'Silverstone',                 '2026-07-04 16:00', '2026-07-05 16:00'),
    (12, 'GP de Belgique',         'BE', 'Spa-Francorchamps',           '2026-07-18 16:00', '2026-07-19 15:00'),
    (13, 'GP de Hongrie',          'HU', 'Hungaroring, Budapest',       '2026-07-25 16:00', '2026-07-26 15:00'),
    (14, 'GP des Pays-Bas',        'NL', 'Zandvoort',                   '2026-08-22 15:00', '2026-08-23 15:00'),
    (15, 'GP d''Italie',           'IT', 'Monza',                       '2026-09-05 16:00', '2026-09-06 15:00'),
    (16, 'GP de Madrid',           'ES', 'Madring, Madrid',             '2026-09-12 16:00', '2026-09-13 15:00'),
    (17, 'GP d''Azerbaïdjan',      'AZ', 'Baku City Circuit',           '2026-09-26 14:00', '2026-09-27 13:00'),
    (18, 'GP de Singapour',        'SG', 'Marina Bay',                  '2026-10-10 15:00', '2026-10-11 14:00'),
    (19, 'GP des États-Unis',      'US', 'COTA, Austin',                '2026-10-24 23:00', '2026-10-25 20:00'),
    (20, 'GP du Mexique',          'MX', 'Hermanos Rodríguez',          '2026-10-31 23:00', '2026-11-01 21:00'),
    (21, 'GP du Brésil',           'BR', 'Interlagos, São Paulo',       '2026-11-07 19:00', '2026-11-08 18:00'),
    (22, 'GP de Las Vegas',        'US', 'Las Vegas Strip',             '2026-11-21 05:00', '2026-11-22 05:00'),
    (23, 'GP du Qatar',            'QA', 'Lusail',                      '2026-11-28 18:00', '2026-11-29 17:00'),
    (24, 'GP d''Abou Dabi',        'AE', 'Yas Marina',                  '2026-12-05 15:00', '2026-12-06 14:00')
) AS r(round, name, iso2, circuit, quali, race);
