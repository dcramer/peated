DO $$ BEGIN
 CREATE TYPE "badge_type" AS ENUM('bottle', 'region', 'category');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "badge_award" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"badge_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"points" smallint DEFAULT 0,
	"level" smallint DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "badges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"type" badge_type NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "badge_award_unq" ON "badge_award" ("badge_id","user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "badge_name_unq" ON "badges" ("name");
DO $$ BEGIN
 ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "badge_award" ADD CONSTRAINT "badge_award_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
