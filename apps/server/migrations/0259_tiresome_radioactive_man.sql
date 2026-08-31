CREATE TABLE "bottle_image" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"image_url" text NOT NULL,
	"source_url" text,
	"license" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "entity_image" ADD COLUMN "source_url" text;
ALTER TABLE "entity_image" ADD COLUMN "license" varchar(255);
ALTER TABLE "bottle_image" ADD CONSTRAINT "bottle_image_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_image" ADD CONSTRAINT "bottle_image_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_image_bottle_idx" ON "bottle_image" USING btree ("bottle_id");
CREATE INDEX "bottle_image_created_by_actor_idx" ON "bottle_image" USING btree ("created_by_actor_id");
CREATE UNIQUE INDEX "bottle_image_primary_unq" ON "bottle_image" USING btree ("bottle_id") WHERE "bottle_image"."is_primary";