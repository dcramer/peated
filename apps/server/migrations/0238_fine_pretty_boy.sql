CREATE TABLE "entity_follow" (
	"user_id" bigint NOT NULL,
	"entity_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_follow_user_id_entity_id_pk" PRIMARY KEY("user_id","entity_id")
);

ALTER TABLE "entity_follow" ADD CONSTRAINT "entity_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entity_follow" ADD CONSTRAINT "entity_follow_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "entity_follow_entity_idx" ON "entity_follow" USING btree ("entity_id");