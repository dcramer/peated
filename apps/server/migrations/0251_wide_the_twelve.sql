CREATE TABLE "entity_image" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" bigint NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "entity_image" ADD CONSTRAINT "entity_image_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entity_image" ADD CONSTRAINT "entity_image_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "entity_image_entity_idx" ON "entity_image" USING btree ("entity_id");
CREATE INDEX "entity_image_created_by_actor_idx" ON "entity_image" USING btree ("created_by_actor_id");
CREATE UNIQUE INDEX "entity_image_primary_unq" ON "entity_image" USING btree ("entity_id") WHERE "entity_image"."is_primary";