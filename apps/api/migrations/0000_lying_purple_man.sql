DO $$ BEGIN
 CREATE TYPE "category" AS ENUM('blend', 'bourbon', 'rye', 'single_grain', 'single_malt', 'spirit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "entity_type" AS ENUM('brand', 'distiller');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "identity_provider" AS ENUM('google');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "object_type" AS ENUM('bottle', 'edition', 'entity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "bottle" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" category,
	"brand_id" bigint NOT NULL,
	"stated_age" smallint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "bottle_distiller" (
	"bottle_id" bigint NOT NULL,
	"distiller_id" bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bottle_distiller" ADD CONSTRAINT "bottle_distiller_bottle_id_distiller_id" PRIMARY KEY("bottle_id","distiller_id");
EXCEPTION
 WHEN syntax_error_or_access_rule_violation THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "change" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"object_id" bigint NOT NULL,
	"object_type" object_type NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "edition" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"barrel" smallint,
	"bottle_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "entity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"region" text,
	"type" entity_type[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "identity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" identity_provider NOT NULL,
	"external_id" text NOT NULL,
	"user_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "tasting" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"edition_id" bigint,
	"comments" text,
	"tags" text[],
	"rating" double precision NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" varchar(256),
	"display_name" text,
	"picture_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "bottle" ADD CONSTRAINT "bottle_brand_id_entity_id_fk" FOREIGN KEY ("brand_id") REFERENCES "entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bottle" ADD CONSTRAINT "bottle_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bottle_distiller" ADD CONSTRAINT "bottle_distiller_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bottle_distiller" ADD CONSTRAINT "bottle_distiller_distiller_id_entity_id_fk" FOREIGN KEY ("distiller_id") REFERENCES "entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "change" ADD CONSTRAINT "change_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "edition" ADD CONSTRAINT "edition_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "edition" ADD CONSTRAINT "edition_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "entity" ADD CONSTRAINT "entity_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "identity" ADD CONSTRAINT "identity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tasting" ADD CONSTRAINT "tasting_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tasting" ADD CONSTRAINT "tasting_edition_id_bottle_id_fk" FOREIGN KEY ("edition_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "tasting" ADD CONSTRAINT "tasting_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "bottle_brand_unq" ON "bottle" ("name","brand_id");
CREATE UNIQUE INDEX IF NOT EXISTS "edition_unq" ON "edition" ("bottle_id","name","barrel");
CREATE UNIQUE INDEX IF NOT EXISTS "entity_name_unq" ON "entity" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "identity_unq" ON "identity" ("provider","external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unq" ON "user" ("email");
