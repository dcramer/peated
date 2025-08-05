ALTER TABLE "bottle" ALTER COLUMN "rating_stats" SET DEFAULT '{"pass":0,"sip":0,"savor":0,"total":0,"avg":null,"percentage":{"pass":0,"sip":0,"savor":0}}'::jsonb;

-- Update existing bottles with empty ratingStats to use the proper structure
UPDATE "bottle" 
SET "rating_stats" = '{"pass":0,"sip":0,"savor":0,"total":0,"avg":null,"percentage":{"pass":0,"sip":0,"savor":0}}'::jsonb
WHERE "rating_stats" = '{}'::jsonb;