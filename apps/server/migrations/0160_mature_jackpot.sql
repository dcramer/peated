-- Add fullName column as nullable first
ALTER TABLE bottle_series ADD COLUMN full_name varchar(255);

-- Update existing bottle_series with fullName
UPDATE bottle_series bs
SET full_name = (
  SELECT e.name || ' ' || bs.name
  FROM entity e
  WHERE e.id = bs.brand_id
);

-- Make fullName NOT NULL after backfill
ALTER TABLE bottle_series ALTER COLUMN full_name SET NOT NULL;
