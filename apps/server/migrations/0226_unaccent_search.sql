CREATE EXTENSION IF NOT EXISTS unaccent;

UPDATE "bottle"
SET "search_vector" = unaccent("search_vector"::text)::tsvector
WHERE "search_vector" IS NOT NULL;

UPDATE "bottle_series"
SET "search_vector" = unaccent("search_vector"::text)::tsvector
WHERE "search_vector" IS NOT NULL;

UPDATE "entity"
SET "search_vector" = unaccent("search_vector"::text)::tsvector
WHERE "search_vector" IS NOT NULL;
