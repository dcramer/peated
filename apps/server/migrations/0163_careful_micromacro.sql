-- Add new columns first
ALTER TABLE "bottle" ADD COLUMN "rating_stats" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "tasting" ADD COLUMN "rating_legacy" double precision;

-- Copy existing ratings to rating_legacy BEFORE we lose precision
UPDATE "tasting" 
SET rating_legacy = rating
WHERE rating IS NOT NULL;

-- Now alter the rating column type and convert to simple ratings
ALTER TABLE "tasting" ALTER COLUMN "rating" SET DATA TYPE smallint USING 
  CASE
    WHEN rating <= 2.0 THEN -1  -- Pass
    WHEN rating > 2.0 AND rating <= 4.0 THEN 1  -- Sip  
    WHEN rating > 4.0 THEN 2  -- Savor
    ELSE NULL
  END;