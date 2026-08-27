-- Existing geocoders stored latitude as X and longitude as Y. PostGIS expects
-- longitude as X and latitude as Y for geodetic coordinates.
UPDATE "country"
SET "location" = ST_FlipCoordinates("location")
WHERE "location" IS NOT NULL;

UPDATE "region"
SET "location" = ST_FlipCoordinates("location")
WHERE "location" IS NOT NULL;

UPDATE "entity"
SET "location" = ST_FlipCoordinates("location")
WHERE "location" IS NOT NULL;
