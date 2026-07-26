-- V57__qualifying_results_time.sql — chrono affiché à côté de la position sur la grille de départ.
-- Meilleur temps atteint par le pilote (Q3 s'il l'a rejoint, sinon Q2, sinon Q1), tel que
-- formaté par jolpica (ex: "1:24.083") — affichage seul, pas de calcul dessus.
ALTER TABLE qualifying_results ADD COLUMN qualifying_time VARCHAR(20);
