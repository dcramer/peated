ALTER TABLE "country" ALTER COLUMN "location" SET DATA TYPE geometry(Point, 4326) USING ST_Transform("location"::geometry, 4326);
ALTER TABLE "entity" ALTER COLUMN "location" SET DATA TYPE geometry(Point, 4326) USING ST_Transform("location"::geometry, 4326);
