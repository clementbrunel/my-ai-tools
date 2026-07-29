-- V61__races_external_circuit_id.sql — colonne stable pour recaler le calendrier F1.
--
-- Le round jolpica n'est pas un identifiant stable : quand un GP est annulé/réintégré
-- en cours de saison (ex: Bahreïn/Arabie saoudite annulés en 2026), tous les rounds
-- suivants se décalent. F1SyncService matchait jusqu'ici par round, ce qui créait une
-- course en double au lieu de mettre à jour la course existante.
ALTER TABLE races ADD COLUMN external_circuit_id VARCHAR(50);
