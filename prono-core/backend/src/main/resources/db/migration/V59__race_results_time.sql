-- V59__race_results_time.sql — temps affiché dans le classement course, à côté de la position.
-- Temps total pour le vainqueur, écart au vainqueur pour les autres, tel que formaté par
-- jolpica (ex: "1:32:53.435", "+22.792") — affichage seul, pas de calcul dessus.
ALTER TABLE race_results ADD COLUMN race_time VARCHAR(20);
