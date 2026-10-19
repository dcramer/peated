CREATE TABLE "tasting_draft" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_by_id" bigint NOT NULL,
	"tasted_at" timestamp NOT NULL,
	"bottle_hint" varchar(255),
	"bottle_id" bigint,
	"image_url" text,
	"rating_band" "tasting_band",
	"notes" text,
	"tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL,
	"serving_style" "servingStyle",
	"color" integer,
	"friends" bigint[] DEFAULT array[]::bigint[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "tasting_draft" ADD CONSTRAINT "tasting_draft_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tasting_draft" ADD CONSTRAINT "tasting_draft_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "tasting_draft_created_by_updated_idx" ON "tasting_draft" USING btree ("created_by_id","updated_at");