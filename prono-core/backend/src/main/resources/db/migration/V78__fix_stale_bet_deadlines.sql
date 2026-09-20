-- V78__fix_stale_bet_deadlines.sql — resynchronise bets.deadline avec l'heure de coup
-- d'envoi / départ actuelle du match / de la course.
--
-- bets.deadline est un instantané pris une seule fois, à l'ouverture du pari
-- (BetService.buildScoreBet / createBet, F1RaceService.buildRaceBet), à partir de
-- matches.match_date / races.race_date. Un rescheduling ultérieur (changement d'horaire
-- de diffusion côté football-data.org, recalage jolpica) met à jour match_date / race_date
-- mais ne touchait jamais bets.deadline — cf le correctif du service (MatchService /
-- F1SyncService) qui resynchronise désormais les paris OPEN à chaque changement d'horaire
-- détecté. Ici on répare les paris déjà périmés en base : un match/course décalé plus tard
-- laissait un deadline resté dans le passé, bloquant les pronos alors que le coup d'envoi
-- réel n'avait pas encore eu lieu.
UPDATE bets b
SET deadline = m.match_date
FROM matches m
WHERE b.match_id = m.id
  AND b.status = 'OPEN'
  AND b.deadline <> m.match_date;

UPDATE bets b
SET deadline = r.race_date
FROM races r
WHERE b.race_id = r.id
  AND b.status = 'OPEN'
  AND b.deadline <> r.race_date;
