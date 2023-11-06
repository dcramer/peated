CREATE TABLE IF NOT EXISTS "collection_bottle" (
	"collection_id" bigint NOT NULL,
	"bottle_id" bigint NOT NULL,
	"edition_id" bigint
);
--> statement-breakpoint
ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_collection_id_bottle_id_edition_id" PRIMARY KEY("collection_id","bottle_id","edition_id");

CREATE TABLE IF NOT EXISTS "collection" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "tasting" ADD CONSTRAINT "tasting_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "edition"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "tasting" DROP CONSTRAINT "tasting_edition_id_bottle_id_fk";

DO $$ BEGIN
 ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "collection_bottle" ADD CONSTRAINT "collection_bottle_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "edition"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "collection" ADD CONSTRAINT "collection_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "collection_name_unq" ON "collection" ("name","created_by_id");
