CREATE TYPE "public"."entity_about_status" AS ENUM('published', 'hidden');
ALTER TYPE "public"."object_type" ADD VALUE 'entity_about';
CREATE TABLE "entity_about" (
	"entity_id" bigint PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"schema_version" smallint NOT NULL,
	"version" integer NOT NULL,
	"status" "entity_about_status" DEFAULT 'published' NOT NULL,
	"checked_on" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "entity_about" ADD CONSTRAINT "entity_about_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;