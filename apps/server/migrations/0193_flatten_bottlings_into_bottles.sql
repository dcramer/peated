ALTER TYPE "public"."object_type" ADD VALUE 'bottle_group' BEFORE 'bottle_release';
CREATE TABLE "bottle_group_distiller" (
	"group_id" bigint NOT NULL,
	"distiller_id" bigint NOT NULL,
	CONSTRAINT "bottle_group_distiller_group_id_distiller_id_pk" PRIMARY KEY("group_id","distiller_id")
);

CREATE TABLE "bottle_group" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"stated_age" smallint,
	"series_id" bigint,
	"category" "category",
	"brand_id" bigint NOT NULL,
	"bottler_id" bigint,
	"flavor_profile" "flavor_profile",
	"representative_bottle_id" bigint,
	"avg_rating" double precision,
	"rating_stats" jsonb DEFAULT '{"pass":0,"sip":0,"savor":0,"total":0,"avg":null,"percentage":{"pass":0,"sip":0,"savor":0}}'::jsonb NOT NULL,
	"total_tastings" bigint DEFAULT 0 NOT NULL,
	"total_bottles" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	CONSTRAINT "bottle_group_stated_age_check" CHECK ("bottle_group"."stated_age" IS NULL OR ("bottle_group"."stated_age" >= 0 AND "bottle_group"."stated_age" <= 100))
);

CREATE TABLE "bottle_release_promotion" (
	"release_id" bigint PRIMARY KEY NOT NULL,
	"promoted_bottle_id" bigint NOT NULL
);

ALTER TABLE "bottle" ADD COLUMN "group_id" bigint;
ALTER TABLE "bottle_group_distiller" ADD CONSTRAINT "bottle_group_distiller_group_id_bottle_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group_distiller" ADD CONSTRAINT "bottle_group_distiller_distiller_id_entity_id_fk" FOREIGN KEY ("distiller_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_series_id_bottle_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."bottle_series"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_brand_id_entity_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_bottler_id_entity_id_fk" FOREIGN KEY ("bottler_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_group" ADD CONSTRAINT "bottle_group_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release_promotion" ADD CONSTRAINT "bottle_release_promotion_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_release_promotion" ADD CONSTRAINT "bottle_release_promotion_promoted_bottle_id_bottle_id_fk" FOREIGN KEY ("promoted_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_group_brand_idx" ON "bottle_group" USING btree ("brand_id");
CREATE INDEX "bottle_group_bottler_idx" ON "bottle_group" USING btree ("bottler_id");
CREATE INDEX "bottle_group_series_idx" ON "bottle_group" USING btree ("series_id");
CREATE INDEX "bottle_group_category_idx" ON "bottle_group" USING btree ("category");
CREATE INDEX "bottle_group_representative_bottle_idx" ON "bottle_group" USING btree ("representative_bottle_id");
CREATE INDEX "bottle_group_created_by_actor_idx" ON "bottle_group" USING btree ("created_by_actor_id");
CREATE INDEX "bottle_release_promotion_bottle_idx" ON "bottle_release_promotion" USING btree ("promoted_bottle_id");
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_group_id_bottle_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_group_idx" ON "bottle" USING btree ("group_id");
CREATE INDEX "flight_bottle_bottle_idx" ON "flight_bottle" USING btree ("bottle_id");
CREATE INDEX "flight_bottle_release_idx" ON "flight_bottle" USING btree ("release_id");
ALTER TABLE "bottle" ADD CONSTRAINT "bottle_id_group_id_unq" UNIQUE("id","group_id");