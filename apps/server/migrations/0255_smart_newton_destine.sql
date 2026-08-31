CREATE TABLE "bottle_alias" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "bottle_alias_bottle_normalized_name_idx" ON "bottle_alias" USING btree ("bottle_id","normalized_name");
CREATE INDEX "bottle_alias_bottle_idx" ON "bottle_alias" USING btree ("bottle_id");
CREATE INDEX "bottle_alias_created_by_actor_idx" ON "bottle_alias" USING btree ("created_by_actor_id");