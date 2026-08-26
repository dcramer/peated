CREATE TYPE "public"."entity_event_kind" AS ENUM('generic', 'opened', 'closed', 'mothballed', 'reopened', 'acquired');
CREATE TABLE "entity_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" bigint NOT NULL,
	"kind" "entity_event_kind" NOT NULL,
	"date" varchar(10) NOT NULL,
	"description" text,
	"new_owner_id" bigint,
	"source_url" text,
	"created_by_actor_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_event_date_check" CHECK ("entity_event"."date" ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'),
	CONSTRAINT "entity_event_generic_description_check" CHECK ("entity_event"."kind" <> 'generic' OR NULLIF(BTRIM("entity_event"."description"), '') IS NOT NULL),
	CONSTRAINT "entity_event_owner_check" CHECK (("entity_event"."kind" = 'acquired' AND "entity_event"."new_owner_id" IS NOT NULL) OR ("entity_event"."kind" <> 'acquired' AND "entity_event"."new_owner_id" IS NULL)),
	CONSTRAINT "entity_event_owner_not_self_check" CHECK ("entity_event"."new_owner_id" IS NULL OR "entity_event"."entity_id" <> "entity_event"."new_owner_id")
);

ALTER TABLE "entity_event" ADD CONSTRAINT "entity_event_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entity_event" ADD CONSTRAINT "entity_event_new_owner_id_entity_id_fk" FOREIGN KEY ("new_owner_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "entity_event" ADD CONSTRAINT "entity_event_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "entity_event_entity_date_idx" ON "entity_event" USING btree ("entity_id","date");
CREATE INDEX "entity_event_new_owner_idx" ON "entity_event" USING btree ("new_owner_id");
CREATE INDEX "entity_event_created_by_actor_idx" ON "entity_event" USING btree ("created_by_actor_id");