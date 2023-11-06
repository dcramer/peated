CREATE TABLE IF NOT EXISTS "flight_bottle" (
	"flight_id" bigint NOT NULL,
	"bottle_id" bigint NOT NULL,
	CONSTRAINT flight_bottle_flight_id_bottle_id PRIMARY KEY("flight_id","bottle_id")
);

CREATE TABLE IF NOT EXISTS "flight" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_flight_id_flight_id_fk" FOREIGN KEY ("flight_id") REFERENCES "flight"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "flight_bottle" ADD CONSTRAINT "flight_bottle_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "flight" ADD CONSTRAINT "flight_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
