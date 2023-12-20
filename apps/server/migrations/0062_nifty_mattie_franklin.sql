ALTER TABLE "tasting" ADD COLUMN "flight_id" bigint;
DO $$ BEGIN
 ALTER TABLE "tasting" ADD CONSTRAINT "tasting_flight_id_flight_id_fk" FOREIGN KEY ("flight_id") REFERENCES "flight"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
