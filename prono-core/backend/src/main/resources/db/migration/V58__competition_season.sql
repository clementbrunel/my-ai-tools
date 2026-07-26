-- V58__competition_season.sql — la saison jolpica (ex: 2026) est une propriété de la
-- compétition, pas un paramètre que chaque appelant doit connaître/deviner à chaque
-- appel de sync (c'était en dur un peu partout : endpoints admin, appels frontend).
ALTER TABLE competitions ADD COLUMN season INT;
UPDATE competitions SET season = 2026 WHERE sport = 'F1';
