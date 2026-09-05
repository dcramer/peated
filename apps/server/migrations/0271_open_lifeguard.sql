ALTER TYPE "public"."scrape_source_kind" ADD VALUE 'catalog';
CREATE TABLE "catalog_listing" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"external_product_id" text,
	"source_fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"volume" integer,
	"source_bottle_identity" jsonb,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "catalog_listing" ADD CONSTRAINT "catalog_listing_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "catalog_listing_site_external_product_unq" ON "catalog_listing" USING btree ("external_site_id","external_product_id") WHERE "catalog_listing"."external_product_id" IS NOT NULL;
CREATE UNIQUE INDEX "catalog_listing_site_url_unq" ON "catalog_listing" USING btree ("external_site_id","url");
CREATE INDEX "catalog_listing_site_last_seen_idx" ON "catalog_listing" USING btree ("external_site_id","last_seen_at");