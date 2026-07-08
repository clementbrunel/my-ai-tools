-- V29__external_fixture_sync.sql
-- Adds API-Football integration fields to matches.
-- external_fixture_id : ID du fixture côté api-football.com (null = non lié)
-- sync_locked         : TRUE quand l'admin a posé le score manuellement → le sync auto ne touche plus ce match
-- auto_synced         : TRUE si le dernier résultat vient du sync automatique (indicateur UI)

ALTER TABLE matches ADD COLUMN external_fixture_id BIGINT NULL;
ALTER TABLE matches ADD COLUMN sync_locked         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN auto_synced          BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_matches_external_fixture_id ON matches(external_fixture_id);
