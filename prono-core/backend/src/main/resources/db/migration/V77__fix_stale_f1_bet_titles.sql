-- V77__fix_stale_f1_bet_titles.sql — resynchronise le titre des paris F1 avec le nom
-- actuel de la course.
--
-- bets.title est un instantané pris à l'ouverture du pari (F1RaceService.buildRaceBet).
-- Avant le correctif de la synchro calendrier (round-shift, cf V61), l'annulation des GP
-- de Bahreïn/Arabie saoudite avait décalé tous les rounds suivants ; une resynchro jolpica
-- pendant cette fenêtre a pu faire pointer un round vers la mauvaise course et écraser le
-- nom d'une course déjà ouverte aux paris (ex: un pari sur le GP des Pays-Bas affichant
-- encore "GP de Belgique"). race_id, résultats et points restaient corrects ; seul le
-- libellé affiché était périmé.
UPDATE bets b
SET title = r.name
FROM races r
WHERE b.race_id = r.id
  AND b.title <> r.name;
