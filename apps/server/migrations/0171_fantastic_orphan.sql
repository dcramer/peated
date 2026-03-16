CREATE TABLE "bottle_observation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"release_id" bigint,
	"source_type" varchar(32) NOT NULL,
	"source_key" varchar(255) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_url" text,
	"external_site_id" bigint,
	"raw_text" text,
	"parsed_identity" jsonb,
	"facts" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint
);

ALTER TABLE "bottle_observation" ADD CONSTRAINT "bottle_observation_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_observation" ADD CONSTRAINT "bottle_observation_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_observation" ADD CONSTRAINT "bottle_observation_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_observation" ADD CONSTRAINT "bottle_observation_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "bottle_observation_source_idx" ON "bottle_observation" USING btree ("source_type","source_key");
CREATE INDEX "bottle_observation_bottle_idx" ON "bottle_observation" USING btree ("bottle_id");
CREATE INDEX "bottle_observation_release_idx" ON "bottle_observation" USING btree ("release_id");
CREATE INDEX "bottle_observation_external_site_idx" ON "bottle_observation" USING btree ("external_site_id");