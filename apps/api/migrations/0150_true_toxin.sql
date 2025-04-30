CREATE TABLE "bottle_edition" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vintage_year" smallint,
	"release_year" smallint,
	"abv" double precision,
	"single_cask" boolean,
	"cask_strength" boolean,
	"stated_age" smallint,
	"cask_size" varchar(255),
	"cask_type" varchar(255),
	"cask_fill" varchar(255),
	"description" text,
	"description_src" "content_source",
	"image_url" text,
	"tasting_notes" jsonb,
	"suggested_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL,
	"avg_rating" double precision,
	"total_tastings" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

ALTER TABLE "bottle_edition" ADD CONSTRAINT "bottle_edition_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_edition" ADD CONSTRAINT "bottle_edition_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_edition_bottle_idx" ON "bottle_edition" USING btree ("bottle_id");
CREATE INDEX "bottle_edition_created_by_idx" ON "bottle_edition" USING btree ("created_by_id");
CREATE UNIQUE INDEX "bottle_edition_full_name_idx" ON "bottle_edition" USING btree ("full_name");
