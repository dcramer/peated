CREATE TABLE "bottle_series" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"brand_id" bigint NOT NULL,
	"description" text,
	"search_vector" "tsvector",
	"num_releases" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

ALTER TABLE "bottle" ADD COLUMN "series_id" bigint;
ALTER TABLE "bottle_series" ADD CONSTRAINT "bottle_series_brand_id_entity_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_series" ADD CONSTRAINT "bottle_series_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "bottle_series_brand_name_key" ON "bottle_series" USING btree ("brand_id","name");
CREATE INDEX "bottle_series_search_idx" ON "bottle_series" USING gin ("search_vector");
CREATE INDEX "bottle_series_brand_idx" ON "bottle_series" USING btree ("brand_id");
CREATE INDEX "bottle_series_created_by_idx" ON "bottle_series" USING btree ("created_by_id");
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_series_id_bottle_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."bottle_series"("id") ON DELETE no action ON UPDATE no action;