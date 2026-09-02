ALTER TABLE "public"."tag" ALTER COLUMN "tag_category" SET DATA TYPE text;

-- Keep every tag name. Only the broad tasting group changes.
UPDATE "public"."tag"
SET "tag_category" = CASE "tag_category"
  WHEN 'fruity' THEN 'fruit'
  WHEN 'peaty' THEN 'smoke'
  WHEN 'feinty' THEN 'earthy'
  WHEN 'sulphury' THEN 'sulfur'
  WHEN 'woody' THEN 'wood'
  WHEN 'winey' THEN 'wood'
  ELSE "tag_category"
END;

UPDATE "public"."tag"
SET "tag_category" = 'fruit'
WHERE "name" IN (
  'currant',
  'date',
  'dried apricot',
  'dried cherry',
  'dried fig',
  'dried fruit',
  'fig',
  'fruitcake',
  'prune',
  'raisin',
  'rich prune',
  'sultana'
);

UPDATE "public"."tag"
SET "tag_category" = 'smoke'
WHERE "name" IN (
  'ash',
  'bacon',
  'balanced smoke',
  'beach',
  'bonfire',
  'brine',
  'campfire',
  'char',
  'charcoal',
  'cigar smoke',
  'coal smoke',
  'creosote',
  'deep peat',
  'diesel',
  'earthy peat',
  'ember',
  'fishing net',
  'flint',
  'gentle peat',
  'heavy iodine',
  'hemp rope',
  'incense',
  'intense smoke',
  'iodine',
  'light smoke',
  'medicinal',
  'mineral',
  'oyster',
  'peat',
  'salt',
  'sea air',
  'seashell',
  'seaweed',
  'shellfish',
  'smoke',
  'smoked fish',
  'smoked herb',
  'smoked meat',
  'smoked salmon',
  'smoked wood',
  'soot',
  'sour ash',
  'tar',
  'wet stone',
  'wood smoke'
);

UPDATE "public"."tag"
SET "tag_category" = 'earthy'
WHERE "name" IN (
  'almond',
  'antique leather',
  'autumn leaf',
  'beeswax',
  'broth',
  'buttermilk',
  'candle wax',
  'cheese',
  'coffee',
  'coffee bean',
  'damp earth',
  'earthiness',
  'espresso',
  'farmyard',
  'forest floor',
  'funk',
  'hazelnut',
  'leather',
  'library book',
  'linseed oil',
  'meat',
  'moss',
  'mushroom',
  'must',
  'nut',
  'oil',
  'old book',
  'olive oil',
  'peanut',
  'pecan',
  'peat moss',
  'polish',
  'roasted coffee',
  'shoe polish',
  'soft musk',
  'sweat',
  'tobacco',
  'tobacco ash',
  'tobacco leaf',
  'toasted almond',
  'turf',
  'umami',
  'walnut',
  'wax',
  'wet earth',
  'wet wool'
);

UPDATE "public"."tag"
SET "tag_category" = 'sulfur'
WHERE "name" IN ('burnt rubber');

UPDATE "public"."tag"
SET "tag_category" = 'sweet'
WHERE "name" IN (
  'brown butter',
  'brown sugar',
  'burnt sugar',
  'butter',
  'butterscotch',
  'cacao',
  'caramel',
  'chocolate',
  'clover honey',
  'cocoa',
  'cream',
  'custard',
  'dark chocolate',
  'heather honey',
  'honey',
  'honeycomb',
  'maple',
  'maple syrup',
  'marshmallow',
  'marzipan',
  'mead',
  'milk chocolate',
  'mocha',
  'molasses',
  'praline',
  'toffee',
  'treacle',
  'vanilla',
  'vanilla bean'
);

UPDATE "public"."tag"
SET "tag_category" = 'spice'
WHERE "name" IN (
  'alcohol burn',
  'allspice',
  'anise',
  'baking spices',
  'black pepper',
  'cardamom',
  'cinnamon',
  'clove',
  'cola',
  'fennel',
  'ginger',
  'gingerbread',
  'licorice',
  'nutmeg',
  'oak spice',
  'red pepper',
  'root beer',
  'spice',
  'white pepper'
);

UPDATE "public"."tag"
SET "tag_category" = 'wood'
WHERE "name" IN ('charred oak');

DROP TYPE "public"."tag_category";
CREATE TYPE "public"."tag_category" AS ENUM('cereal', 'fruit', 'floral', 'smoke', 'earthy', 'sulfur', 'sweet', 'spice', 'wood');
ALTER TABLE "public"."tag" ALTER COLUMN "tag_category" SET DATA TYPE "public"."tag_category" USING "tag_category"::"public"."tag_category";
