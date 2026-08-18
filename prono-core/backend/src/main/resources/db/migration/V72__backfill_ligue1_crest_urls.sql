-- Ligue 1 teams were first created via fixture import (findOrCreateTeamInRoster), which
-- doesn't carry a crest. The football-data.org roster sync should have backfilled
-- crest_url afterwards but didn't take effect in production — backfill it directly.
UPDATE teams SET crest_url = 'https://crests.football-data.org/511.png' WHERE name = 'Toulouse FC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/512.png' WHERE name = 'Stade Brestois 29';
UPDATE teams SET crest_url = 'https://crests.football-data.org/516.png' WHERE name = 'Olympique de Marseille';
UPDATE teams SET crest_url = 'https://crests.football-data.org/519.png' WHERE name = 'AJ Auxerre';
UPDATE teams SET crest_url = 'https://crests.football-data.org/521.png' WHERE name = 'Lille OSC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/522.png' WHERE name = 'OGC Nice';
UPDATE teams SET crest_url = 'https://crests.football-data.org/523.png' WHERE name = 'Olympique Lyonnais';
UPDATE teams SET crest_url = 'https://crests.football-data.org/524.png' WHERE name = 'Paris Saint-Germain FC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/525.png' WHERE name = 'FC Lorient';
UPDATE teams SET crest_url = 'https://crests.football-data.org/529.png' WHERE name = 'Stade Rennais FC 1901';
UPDATE teams SET crest_url = 'https://crests.football-data.org/531.png' WHERE name = 'ES Troyes AC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/532.png' WHERE name = 'Angers SCO';
UPDATE teams SET crest_url = 'https://crests.football-data.org/533.png' WHERE name = 'Le Havre AC';
UPDATE teams SET crest_url = 'https://upload.wikimedia.org/wikipedia/en/5/57/Le_Mans_FC_logo.svg' WHERE name = 'Le Mans FC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/546.png' WHERE name = 'Racing Club de Lens';
UPDATE teams SET crest_url = 'https://crests.football-data.org/548.png' WHERE name = 'AS Monaco FC';
UPDATE teams SET crest_url = 'https://crests.football-data.org/576.png' WHERE name = 'RC Strasbourg Alsace';
UPDATE teams SET crest_url = 'https://crests.football-data.org/1045.png' WHERE name = 'Paris FC';
