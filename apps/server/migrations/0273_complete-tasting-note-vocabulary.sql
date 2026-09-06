-- Complete Peated's concrete aroma and flavor vocabulary while preserving the
-- existing nine tasting-wheel categories. Canonical names, synonym decisions,
-- exclusions, and source membership live in
-- apps/server/src/data/tastingNoteVocabulary.ts.
--
-- This Peated-authored inventory synthesizes:
-- https://www.whiskeymasters.org/bourbon-tasting-flavor-wheel
-- https://peated.com/reviews
-- https://www.whiskeymasters.org/whisky-tasting-wheel
-- https://doi.org/10.1002/j.2050-0416.2001.tb00099.x
-- https://www.wsetglobal.com/media/17557/wset_l3spirits_sat_en_feb2025_issue3.pdf
CREATE TEMP TABLE "tasting_note_vocabulary_0273" (
  "name" varchar(64) PRIMARY KEY,
  "synonyms" varchar(64)[] NOT NULL,
  "tag_category" "tag_category" NOT NULL
) ON COMMIT DROP;

INSERT INTO "tasting_note_vocabulary_0273" (
  "name",
  "synonyms",
  "tag_category"
)
VALUES
  ('baked potato', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('boiled corn', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('charred grain', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('cooked grain', ARRAY['cooked grains']::varchar[], 'cereal'::"tag_category"),
  ('cornmeal', ARRAY['corn meal']::varchar[], 'cereal'::"tag_category"),
  ('draff', ARRAY['mash tun draff', 'spent grain']::varchar[], 'cereal'::"tag_category"),
  ('husk', ARRAY['husky']::varchar[], 'cereal'::"tag_category"),
  ('mashed potato', ARRAY['mashed potatoes']::varchar[], 'cereal'::"tag_category"),
  ('wheat bread', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('wort', ARRAY[]::varchar[], 'cereal'::"tag_category"),
  ('artificial fruit', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('blood orange', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('catty', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('fruit cobbler', ARRAY['cobbler']::varchar[], 'fruit'::"tag_category"),
  ('green banana', ARRAY['green bananas']::varchar[], 'fruit'::"tag_category"),
  ('honeydew', ARRAY['honeydew melon']::varchar[], 'fruit'::"tag_category"),
  ('kirsch', ARRAY['cherry brandy']::varchar[], 'fruit'::"tag_category"),
  ('lemon juice', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('lemonade', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('paint', ARRAY['paint fumes']::varchar[], 'fruit'::"tag_category"),
  ('peach nectar', ARRAY[]::varchar[], 'fruit'::"tag_category"),
  ('pith', ARRAY['citrus pith', 'orange pith']::varchar[], 'fruit'::"tag_category"),
  ('pomelo', ARRAY['pomelos']::varchar[], 'fruit'::"tag_category"),
  ('rind', ARRAY['citrus rind', 'fruit rind', 'orange rind']::varchar[], 'fruit'::"tag_category"),
  ('sour', ARRAY['sourness', 'tangy', 'tart']::varchar[], 'fruit'::"tag_category"),
  ('stewed apple', ARRAY['stewed apples']::varchar[], 'fruit'::"tag_category"),
  ('tomato stem', ARRAY['tomato stems']::varchar[], 'fruit'::"tag_category"),
  ('vinegar', ARRAY['vinegary']::varchar[], 'fruit'::"tag_category"),
  ('barber shop', ARRAY['barber''s shop', 'barbershop']::varchar[], 'floral'::"tag_category"),
  ('bluebell', ARRAY['bluebells', 'blue bell']::varchar[], 'floral'::"tag_category"),
  ('carnation', ARRAY['carnations']::varchar[], 'floral'::"tag_category"),
  ('cough syrup', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('dead flower', ARRAY['dead flowers']::varchar[], 'floral'::"tag_category"),
  ('dried herb', ARRAY['dried herbs']::varchar[], 'floral'::"tag_category"),
  ('dry grass', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('dry hay', ARRAY['dried hay']::varchar[], 'floral'::"tag_category"),
  ('fabric softener', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('fir', ARRAY['fir bud', 'fir buds', 'fir resin']::varchar[], 'floral'::"tag_category"),
  ('florist shop', ARRAY['florist''s shop']::varchar[], 'floral'::"tag_category"),
  ('flower stem', ARRAY['flower stems']::varchar[], 'floral'::"tag_category"),
  ('foliage', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('herb', ARRAY['herbs']::varchar[], 'floral'::"tag_category"),
  ('mulch', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('mown hay', ARRAY['mowed hay']::varchar[], 'floral'::"tag_category"),
  ('oolong tea', ARRAY['oolong']::varchar[], 'floral'::"tag_category"),
  ('potpourri', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('straw', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('tarragon', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('vegetal', ARRAY['vegetation']::varchar[], 'floral'::"tag_category"),
  ('white lily', ARRAY['white lilies', 'white lilly']::varchar[], 'floral'::"tag_category"),
  ('wintergreen', ARRAY[]::varchar[], 'floral'::"tag_category"),
  ('anchovy', ARRAY['anchovies']::varchar[], 'smoke'::"tag_category"),
  ('antiseptic', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('barbecue', ARRAY['barbeque', 'bbq']::varchar[], 'smoke'::"tag_category"),
  ('brackish', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('burnt stick', ARRAY['burnt sticks']::varchar[], 'smoke'::"tag_category"),
  ('camphor', ARRAY['camphorous']::varchar[], 'smoke'::"tag_category"),
  ('carbolic', ARRAY['carbolic soap']::varchar[], 'smoke'::"tag_category"),
  ('damp cement', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('hospital', ARRAY['hospitals', 'hospital ward']::varchar[], 'smoke'::"tag_category"),
  ('kipper', ARRAY['kippers', 'kippery']::varchar[], 'smoke'::"tag_category"),
  ('lint', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('moss water', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('peat reek', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('tcp', ARRAY[]::varchar[], 'smoke'::"tag_category"),
  ('boiled pork', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('brewed coffee', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('cardboard', ARRAY['cardboard box']::varchar[], 'earthy'::"tag_category"),
  ('cashew', ARRAY['cashews']::varchar[], 'earthy'::"tag_category"),
  ('cellar', ARRAY['cellars']::varchar[], 'earthy'::"tag_category"),
  ('chestnut', ARRAY['chestnuts']::varchar[], 'earthy'::"tag_category"),
  ('chip fat', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('cigar', ARRAY['cigars']::varchar[], 'earthy'::"tag_category"),
  ('cigarette', ARRAY['cigarettes']::varchar[], 'earthy'::"tag_category"),
  ('dust', ARRAY['dusty']::varchar[], 'earthy'::"tag_category"),
  ('engine oil', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('feet', ARRAY['foot odor', 'foot odour']::varchar[], 'earthy'::"tag_category"),
  ('filter paper', ARRAY['filter sheet', 'filter sheets']::varchar[], 'earthy'::"tag_category"),
  ('ground coffee', ARRAY['coffee grounds']::varchar[], 'earthy'::"tag_category"),
  ('gravy', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('lanolin', ARRAY['lanoline']::varchar[], 'earthy'::"tag_category"),
  ('meat fat', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('mold', ARRAY['moldy', 'mould', 'mouldy']::varchar[], 'earthy'::"tag_category"),
  ('mothball', ARRAY['mothballs']::varchar[], 'earthy'::"tag_category"),
  ('mousy', ARRAY['mousey']::varchar[], 'earthy'::"tag_category"),
  ('naphtha', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('new carpet', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('old gym shoe', ARRAY['old gym shoes']::varchar[], 'earthy'::"tag_category"),
  ('olive', ARRAY['olives']::varchar[], 'earthy'::"tag_category"),
  ('paper', ARRAY['papery']::varchar[], 'earthy'::"tag_category"),
  ('paraffin', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('pine nut', ARRAY['pine nuts']::varchar[], 'earthy'::"tag_category"),
  ('pipe tobacco', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('rain', ARRAY['rainwater']::varchar[], 'earthy'::"tag_category"),
  ('rancid', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('rancio', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('rickhouse', ARRAY['rick house']::varchar[], 'earthy'::"tag_category"),
  ('sausage', ARRAY['sausages']::varchar[], 'earthy'::"tag_category"),
  ('soapy', ARRAY['soap']::varchar[], 'earthy'::"tag_category"),
  ('suntan oil', ARRAY['sun tan oil']::varchar[], 'earthy'::"tag_category"),
  ('wet concrete', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('wet dog', ARRAY[]::varchar[], 'earthy'::"tag_category"),
  ('yogurt', ARRAY['yoghurt']::varchar[], 'earthy'::"tag_category"),
  ('coal gas', ARRAY['coal-gas', 'gassy']::varchar[], 'sulfur'::"tag_category"),
  ('decaying', ARRAY['decay']::varchar[], 'sulfur'::"tag_category"),
  ('drain', ARRAY['drains']::varchar[], 'sulfur'::"tag_category"),
  ('fresh laundry', ARRAY[]::varchar[], 'sulfur'::"tag_category"),
  ('garden hose', ARRAY['rubber hose']::varchar[], 'sulfur'::"tag_category"),
  ('linen', ARRAY[]::varchar[], 'sulfur'::"tag_category"),
  ('plastic', ARRAY['plasticky']::varchar[], 'sulfur'::"tag_category"),
  ('plastic rope', ARRAY[]::varchar[], 'sulfur'::"tag_category"),
  ('vomit', ARRAY['vomity']::varchar[], 'sulfur'::"tag_category"),
  ('baker''s chocolate', ARRAY['bakers chocolate']::varchar[], 'sweet'::"tag_category"),
  ('candy', ARRAY['confectionery', 'sweets']::varchar[], 'sweet'::"tag_category"),
  ('crème caramel', ARRAY['creme caramel']::varchar[], 'sweet'::"tag_category"),
  ('ice cream', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('liqueur', ARRAY['liquor cordial']::varchar[], 'sweet'::"tag_category"),
  ('madeira cake', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('mince pie', ARRAY['mince pies']::varchar[], 'sweet'::"tag_category"),
  ('popcorn butter', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('sponge cake', ARRAY['sponge']::varchar[], 'sweet'::"tag_category"),
  ('sweet', ARRAY['sweetness']::varchar[], 'sweet'::"tag_category"),
  ('syrup', ARRAY['syrupy']::varchar[], 'sweet'::"tag_category"),
  ('white chocolate', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('white sugar', ARRAY[]::varchar[], 'sweet'::"tag_category"),
  ('wood sugar', ARRAY['wood sugars']::varchar[], 'sweet'::"tag_category"),
  ('chili', ARRAY['chile', 'chilli', 'red chili', 'red chilli']::varchar[], 'spice'::"tag_category"),
  ('green pepper', ARRAY['green peppers']::varchar[], 'spice'::"tag_category"),
  ('jalapeño', ARRAY['jalapeno', 'jalapeños', 'jalapenos']::varchar[], 'spice'::"tag_category"),
  ('mustard', ARRAY[]::varchar[], 'spice'::"tag_category"),
  ('paprika', ARRAY[]::varchar[], 'spice'::"tag_category"),
  ('pink peppercorn', ARRAY['pink peppercorns', 'pink pepper']::varchar[], 'spice'::"tag_category"),
  ('star anise', ARRAY[]::varchar[], 'spice'::"tag_category"),
  ('acrid', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('balsa', ARRAY['balsa wood']::varchar[], 'wood'::"tag_category"),
  ('bitter', ARRAY['bitterness']::varchar[], 'wood'::"tag_category"),
  ('bourbon', ARRAY['bourbon cask']::varchar[], 'wood'::"tag_category"),
  ('brandy', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('cork', ARRAY['corked', 'corky']::varchar[], 'wood'::"tag_category"),
  ('green bark', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('hickory', ARRAY['hickory wood']::varchar[], 'wood'::"tag_category"),
  ('ink', ARRAY['inky']::varchar[], 'wood'::"tag_category"),
  ('lacquer', ARRAY['wood lacquer']::varchar[], 'wood'::"tag_category"),
  ('mahogany', ARRAY['mahogany wood']::varchar[], 'wood'::"tag_category"),
  ('marsala', ARRAY['marsala wine']::varchar[], 'wood'::"tag_category"),
  ('retsina', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('sour cask', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('tequila', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('tokaji', ARRAY['tokay']::varchar[], 'wood'::"tag_category"),
  ('turpentine', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('varnish', ARRAY['varnished wood', 'wood varnish']::varchar[], 'wood'::"tag_category"),
  ('vin santo', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('wet wood', ARRAY[]::varchar[], 'wood'::"tag_category"),
  ('ash', ARRAY['ashes', 'cold ash', 'cold ashes']::varchar[], 'smoke'::"tag_category"),
  ('bacon', ARRAY['smoked bacon']::varchar[], 'smoke'::"tag_category"),
  ('biscuit', ARRAY['digestive biscuit']::varchar[], 'cereal'::"tag_category"),
  ('black pepper', ARRAY['peppery']::varchar[], 'spice'::"tag_category"),
  ('bran', ARRAY['oat bran', 'rice bran', 'wheat bran']::varchar[], 'cereal'::"tag_category"),
  ('brown sugar', ARRAY['demerara sugar']::varchar[], 'sweet'::"tag_category"),
  ('caramel', ARRAY['caramel sauce']::varchar[], 'sweet'::"tag_category"),
  ('citrus', ARRAY['zesty']::varchar[], 'fruit'::"tag_category"),
  ('cola', ARRAY['dr pepper', 'dr. pepper']::varchar[], 'spice'::"tag_category"),
  ('corn', ARRAY['maize']::varchar[], 'cereal'::"tag_category"),
  ('dried fruit', ARRAY['dehydrated fruit']::varchar[], 'fruit'::"tag_category"),
  ('farmyard', ARRAY['cattle', 'farmy']::varchar[], 'earthy'::"tag_category"),
  ('fruit', ARRAY['fruitiness', 'fruits']::varchar[], 'fruit'::"tag_category"),
  ('green herb', ARRAY['green herbs']::varchar[], 'floral'::"tag_category"),
  ('hops', ARRAY['dried hops']::varchar[], 'cereal'::"tag_category"),
  ('jam', ARRAY['fruit jelly', 'jelly', 'preserves']::varchar[], 'fruit'::"tag_category"),
  ('lemon', ARRAY['lemony']::varchar[], 'fruit'::"tag_category"),
  ('library book', ARRAY['old library']::varchar[], 'earthy'::"tag_category"),
  ('malt', ARRAY['malty']::varchar[], 'cereal'::"tag_category"),
  ('metal', ARRAY['metallic', 'tinny']::varchar[], 'sulfur'::"tag_category"),
  ('mineral', ARRAY['minerality']::varchar[], 'smoke'::"tag_category"),
  ('must', ARRAY['fusty']::varchar[], 'earthy'::"tag_category"),
  ('oil', ARRAY['oils']::varchar[], 'earthy'::"tag_category"),
  ('peat', ARRAY['phenolic']::varchar[], 'smoke'::"tag_category"),
  ('pencil shaving', ARRAY['pencil', 'sharpened pencil']::varchar[], 'wood'::"tag_category"),
  ('pine', ARRAY['pine essence']::varchar[], 'floral'::"tag_category"),
  ('polish', ARRAY['wood polish']::varchar[], 'earthy'::"tag_category"),
  ('rotten egg', ARRAY['egg']::varchar[], 'sulfur'::"tag_category"),
  ('salt', ARRAY['saline', 'salinity', 'saltiness', 'sea water', 'seawater']::varchar[], 'smoke'::"tag_category"),
  ('sea air', ARRAY['coastal', 'maritime']::varchar[], 'smoke'::"tag_category"),
  ('sherry', ARRAY['sherried']::varchar[], 'wood'::"tag_category"),
  ('solvent', ARRAY['fusel oil', 'nail varnish remover', 'paint thinner']::varchar[], 'fruit'::"tag_category"),
  ('spice', ARRAY['spices']::varchar[], 'spice'::"tag_category"),
  ('stagnant water', ARRAY['stagnant']::varchar[], 'sulfur'::"tag_category"),
  ('struck match', ARRAY['spent match', 'spent matches']::varchar[], 'sulfur'::"tag_category"),
  ('tropical fruit', ARRAY['tropical fruits']::varchar[], 'fruit'::"tag_category"),
  ('wax', ARRAY['waxiness']::varchar[], 'earthy'::"tag_category"),
  ('wood', ARRAY['woods']::varchar[], 'wood'::"tag_category");

-- Stop if production has drifted in a way that would make a canonical name or
-- synonym ambiguous. The tag vocabulary is shared by saved tastings and review
-- extraction, so silently choosing an owner would corrupt meaning.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0273" AS "expected"
    JOIN "tag" AS "actual" USING ("name")
    WHERE "actual"."tag_category" <> "expected"."tag_category"
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0273 found an existing name in a different category';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0273" AS "expected"
    JOIN "tag" AS "actual"
      ON "expected"."name" = ANY("actual"."synonyms")
    WHERE "actual"."name" <> "expected"."name"
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0273 found a canonical name owned as another tag synonym';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0273" AS "expected"
    CROSS JOIN LATERAL unnest("expected"."synonyms") AS "declared"("synonym")
    JOIN "tag" AS "actual"
      ON "actual"."name" = "declared"."synonym"
      OR "declared"."synonym" = ANY("actual"."synonyms")
    WHERE "actual"."name" <> "expected"."name"
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0273 found a synonym owned by another tag';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0273" AS "expected"
    CROSS JOIN LATERAL unnest("expected"."synonyms") AS "declared"("synonym")
    JOIN "tasting_note_vocabulary_0273" AS "other"
      ON "declared"."synonym" = "other"."name"
    WHERE "other"."name" <> "expected"."name"
  ) OR EXISTS (
    SELECT "declared"."synonym"
    FROM "tasting_note_vocabulary_0273" AS "expected"
    CROSS JOIN LATERAL unnest("expected"."synonyms") AS "declared"("synonym")
    GROUP BY "declared"."synonym"
    HAVING count(DISTINCT "expected"."name") > 1
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0273 contains an internal name or synonym collision';
  END IF;
END $$;

INSERT INTO "tag" ("name", "synonyms", "tag_category")
SELECT "name", "synonyms", "tag_category"
FROM "tasting_note_vocabulary_0273"
ON CONFLICT ("name") DO NOTHING;

UPDATE "tag" AS "actual"
SET "synonyms" = ARRAY(
  SELECT DISTINCT "synonym"
  FROM unnest("actual"."synonyms" || "expected"."synonyms") AS "synonym"
  ORDER BY "synonym"
)
FROM "tasting_note_vocabulary_0273" AS "expected"
WHERE "actual"."name" = "expected"."name"
  AND "actual"."tag_category" = "expected"."tag_category";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tasting_note_vocabulary_0273" AS "expected"
    LEFT JOIN "tag" AS "actual" USING ("name")
    WHERE "actual"."name" IS NULL
      OR "actual"."tag_category" <> "expected"."tag_category"
      OR NOT "actual"."synonyms" @> "expected"."synonyms"
  ) THEN
    RAISE EXCEPTION 'Tasting note vocabulary 0273 did not install the expected names, synonyms, and categories';
  END IF;
END $$;
