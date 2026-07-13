-- V45__f1_sprint_results.sql — Les sprints comptent au championnat.
--
-- Pas de paris sur les sprints : seule la position du sprint est stockée
-- sur la ligne de résultat du week-end, pour que les standings pilotes et
-- constructeurs incluent les points sprint FIA (8-7-6-5-4-3-2-1).

ALTER TABLE races ADD COLUMN sprint_date TIMESTAMP;               -- null = week-end sans sprint
ALTER TABLE race_results ADD COLUMN sprint_position INT;          -- null = pas de sprint / non classé
