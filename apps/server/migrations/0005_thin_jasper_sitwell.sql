ALTER TYPE "object_type" ADD VALUE 'tasting';
ALTER TYPE "object_type" ADD VALUE 'toast';
ALTER TYPE "object_type" ADD VALUE 'follow';
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"from_user_id" bigint,
	"object_id" bigint NOT NULL,
	"object_type" object_type NOT NULL,
	"created_at" timestamp NOT NULL,
	"read" boolean DEFAULT false NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_unq" ON "notifications" ("user_id","object_id","object_type","created_at");