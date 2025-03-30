-- Custom SQL migration file, put your code below! --

-- Create bottle_series entries from distinct series names in bottles
INSERT INTO bottle_series (name, brand_id, created_at, updated_at, created_by_id)
SELECT DISTINCT ON (b.series, b.brand_id)
  b.series as name,
  b.brand_id,
  NOW() as created_at,
  NOW() as updated_at,
  b.created_by_id
FROM bottle b
WHERE b.series IS NOT NULL AND b.series != '';

-- Update bottles to reference the newly created series
WITH series_mapping AS (
  SELECT 
    bs.id as series_id,
    bs.name,
    bs.brand_id
  FROM bottle_series bs
)
UPDATE bottle b
SET series_id = sm.series_id
FROM series_mapping sm
WHERE b.series = sm.name
  AND b.brand_id = sm.brand_id
  AND b.series IS NOT NULL AND b.series != '';
