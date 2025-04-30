ALTER TYPE "object_type" ADD VALUE 'comment';
CREATE TABLE IF NOT EXISTS "comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tasting_id" bigint NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

ALTER TABLE "tasting" RENAME COLUMN "comments" TO "notes";
ALTER TABLE "tasting" ADD COLUMN "comments" integer DEFAULT 0 NOT NULL;
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_tasting_id_tasting_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "tasting"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "comment_unq" ON "comments" ("tasting_id","created_by_id","created_at");
