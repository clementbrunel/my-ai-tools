-- Starting grid validation, mirroring the race-results draft: a jolpica import (or a manual
-- entry not yet confirmed) is admin-only until the platform admin validates it. Existing grids
-- were already shown to players, so they're grandfathered as validated.
ALTER TABLE races ADD COLUMN qualifying_validated BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE races SET qualifying_validated = TRUE
 WHERE id IN (SELECT DISTINCT race_id FROM qualifying_results);

-- Post-qualifying auto-import: the "jolpica still has no grid" reminder goes out once per race.
ALTER TABLE races ADD COLUMN qualifying_late_alert_sent BOOLEAN NOT NULL DEFAULT FALSE;
