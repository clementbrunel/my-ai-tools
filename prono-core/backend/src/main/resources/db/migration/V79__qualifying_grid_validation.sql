-- Starting grid validation, mirroring the race-results draft: a jolpica import (or a manual
-- entry not yet confirmed) is admin-only until the platform admin validates it. Existing grids
-- were already shown to players, so they're grandfathered as validated.
ALTER TABLE races ADD COLUMN qualifying_validated BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE races SET qualifying_validated = TRUE
 WHERE id IN (SELECT DISTINCT race_id FROM qualifying_results);
