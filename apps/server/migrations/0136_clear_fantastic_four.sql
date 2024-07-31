CREATE TABLE IF NOT EXISTS "event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date,
	"description" text,
	"website" varchar(255),
	"country_id" bigint,
	"address" text,
	"location" geometry(Point, 4326),
	"repeats" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "event" ADD CONSTRAINT "event_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "event_name_unq" ON "event" USING btree ("date_start",LOWER("name"));
CREATE INDEX IF NOT EXISTS "event_country_id" ON "event" USING btree ("country_id");