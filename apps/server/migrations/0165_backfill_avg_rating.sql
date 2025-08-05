-- Backfill avgRating column with average of new simple rating values
UPDATE "bottle" 
SET "avg_rating" = (
    SELECT AVG(rating)
    FROM "tasting" 
    WHERE "tasting"."bottle_id" = "bottle"."id" 
    AND "tasting"."rating" IS NOT NULL
)
WHERE EXISTS (
    SELECT 1 
    FROM "tasting" 
    WHERE "tasting"."bottle_id" = "bottle"."id" 
    AND "tasting"."rating" IS NOT NULL
);

-- Also update bottles with no ratings to have NULL avgRating
UPDATE "bottle"
SET "avg_rating" = NULL
WHERE NOT EXISTS (
    SELECT 1 
    FROM "tasting" 
    WHERE "tasting"."bottle_id" = "bottle"."id" 
    AND "tasting"."rating" IS NOT NULL
);