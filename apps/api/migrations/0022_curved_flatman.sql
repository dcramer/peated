CREATE TABLE IF NOT EXISTS "bottle_tag" (
	"bottle_id" bigint NOT NULL,
	"tag" varchar(64) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bottle_tag" ADD CONSTRAINT "bottle_tag_bottle_id_tag" PRIMARY KEY("bottle_id", "tag");

DO $$ BEGIN
 ALTER TABLE "bottle_tag" ADD CONSTRAINT "bottle_tag_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "tasting" ALTER COLUMN "tags" SET DATA TYPE varchar(64)[];

INSERT INTO "bottle_tag" ("bottle_id", "tag", "count")
  SELECT "tasting"."bottle_id", unnest("tasting"."tags") as "tag", COUNT(*) as "count"
  FROM "tasting"
  GROUP BY "bottle_id", "tag"
  ON CONFLICT ("bottle_id", "tag") DO UPDATE
    SET "count" = excluded.count;
