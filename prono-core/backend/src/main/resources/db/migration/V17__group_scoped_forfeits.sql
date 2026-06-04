-- V17__group_scoped_forfeits.sql
-- Forfeits (the gage library) become group-aware:
--   group_id NULL  => SHARED gage, visible to every group (all existing gages stay shared)
--   group_id = X   => gage that belongs to group X only (player additions stay in their group)

ALTER TABLE forfeits ADD COLUMN group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX idx_forfeits_group_id ON forfeits(group_id);
