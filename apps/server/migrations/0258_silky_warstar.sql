CREATE TABLE "entity_alias" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "entity_alias" ADD CONSTRAINT "entity_alias_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entity_alias" ADD CONSTRAINT "entity_alias_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "entity_alias_entity_normalized_name_idx" ON "entity_alias" USING btree ("entity_id","normalized_name");
CREATE INDEX "entity_alias_entity_idx" ON "entity_alias" USING btree ("entity_id");
CREATE INDEX "entity_alias_created_by_actor_idx" ON "entity_alias" USING btree ("created_by_actor_id");