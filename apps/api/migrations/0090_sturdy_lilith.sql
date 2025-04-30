DO $$ BEGIN
 CREATE TYPE "flavor_profile" AS ENUM(
  'young_spritely',
  'sweet_fruit_mellow',
  'spicy_sweet',
  'spicy_dry',
  'deep_rich_dried_fruit',
  'old_dignified',
  'light_delicate',
  'juicy_oak_vanilla',
  'oily_coastal',
  'lightly_peated',
  'peated',
  'heavily_peated'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "bottle" ADD COLUMN "flavor_profile" "flavor_profile";
