-- Add familiar tasting notes used across American and other whiskies.
--
-- Tasting wheel owns this grouping rule: classify a compound note by the whole
-- thing it resembles, not by one ingredient or where the flavor came from.
-- This Peated-authored expansion synthesizes:
-- https://www.wsetglobal.com/media/16506/wset_l3spirits_sat_en_feb2025_issue3.pdf
-- https://www.whiskeymasters.org/bourbon-tasting-flavor-wheel
-- https://www.jpwisers.com/wp-content/uploads/Whisky-Wheel-Dr-Don-Livermore.pdf
-- https://doi.org/10.1111/1750-3841.14468
-- https://doi.org/10.1002/jib.596
-- https://www.sazerac.com/our-brands/sazerac-rye-whiskey.html
-- https://www.stillaustin.com/limited-releases
-- https://greenbrierdistillery.com/pages/distillery-exclusives
-- https://www.fourrosesbourbon.com/bourbon/small-batch-select
-- https://www.buffalotracedistillery.com/our-brands/e-h-taylor-jr/colonel-e-h-taylor-jr-distillers-council/
CREATE TEMP TABLE "tasting_note_vocabulary_0270" (
  "name" varchar(64) PRIMARY KEY,
  "synonyms" varchar(64)[] NOT NULL,
  "tag_category" "tag_category" NOT NULL
) ON COMMIT DROP;

INSERT INTO "tasting_note_vocabulary_0270" ("name", "synonyms", "tag_category")
VALUES
  ('black tea', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('candy corn', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('caraway', ARRAY['caraway seed', 'caraway seeds']::varchar[], 'spice'::"tag_category"),
  ('cotton candy', ARRAY['candy floss', 'candyfloss']::varchar[], 'sweet'::"tag_category"),
  ('crème brûlée', ARRAY['creme brulee', 'creme brûlée', 'crème brulee']::varchar[], 'sweet'::"tag_category"),
  ('dill pickle', ARRAY['dill pickles', 'dill pickle juice']::varchar[], 'floral'::"tag_category"),
  ('fudge', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('graham cracker', ARRAY['graham crackers']::varchar[], 'cereal'::"tag_category"),
  ('nougat', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('peanut brittle', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('pecan pie', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('peppermint', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('rock candy', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('rye bread', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('salted caramel', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('saltwater taffy', ARRAY['salt water taffy', 'taffy']::varchar[], 'sweet'::"tag_category"),
  ('sawdust', ARRAY['saw dust']::varchar[], 'wood'::"tag_category"),
  ('spearmint', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('sweet corn', ARRAY['sweetcorn']::varchar[], 'cereal'::"tag_category"),
  ('toasted marshmallow', ARRAY['toasted marshmallows']::varchar[], 'sweet'::"tag_category");

-- Preserve any same-named row created before deployment, then fail rather than
-- silently accepting different synonyms or a different tasting-wheel group.
INSERT INTO "tag" ("name", "synonyms", "tag_category")
SELECT "name", "synonyms", "tag_category"
FROM "tasting_note_vocabulary_0270"
ON CONFLICT ("name") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0270" AS "expected"
    LEFT JOIN "tag" AS "actual" USING ("name")
    WHERE "actual"."name" IS NULL
      OR "actual"."synonyms" <> "expected"."synonyms"
      OR "actual"."tag_category" <> "expected"."tag_category"
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0270 did not match the expected names, synonyms, and categories';
  END IF;
END $$;
