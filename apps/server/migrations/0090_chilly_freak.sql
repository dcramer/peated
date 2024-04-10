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

CREATE TABLE IF NOT EXISTS "bottle_flavor_profile" (
	"bottle_id" bigint NOT NULL,
	"flavor_profile" "flavor_profile" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bottle_flavor_profile_bottle_id_flavor_profile_pk" PRIMARY KEY("bottle_id","flavor_profile")
);

ALTER TABLE "bottle" ADD COLUMN "flavor_profile" "flavor_profile";
ALTER TABLE "tasting" ADD COLUMN "flavor_profile" "flavor_profile";
DO $$ BEGIN
 ALTER TABLE "bottle_flavor_profile" ADD CONSTRAINT "bottle_flavor_profile_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
