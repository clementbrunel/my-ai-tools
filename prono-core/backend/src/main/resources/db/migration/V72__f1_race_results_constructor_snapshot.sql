-- V72__f1_race_results_constructor_snapshot.sql — per-race constructor snapshot.
--
-- Standings were computed by joining race_results -> drivers -> constructors,
-- i.e. from the driver's CURRENT constructor_id, not the team they actually
-- raced for that weekend. A mid-season loan/swap (e.g. a driver covering one
-- GP for another team while their seat is filled by a substitute) would, the
-- moment drivers.constructor_id is updated, retroactively reattribute every
-- past race_results row for that driver to the new team — corrupting the
-- season-long constructor standings. Snapshotting the constructor on each
-- race_results row at entry time makes every result immutable history,
-- independent of later roster changes.

ALTER TABLE race_results ADD COLUMN constructor_id BIGINT REFERENCES constructors(id);

UPDATE race_results rr
SET constructor_id = d.constructor_id
FROM drivers d
WHERE d.id = rr.driver_id AND rr.constructor_id IS NULL;

ALTER TABLE race_results ALTER COLUMN constructor_id SET NOT NULL;

CREATE INDEX idx_race_results_constructor_id ON race_results(constructor_id);
