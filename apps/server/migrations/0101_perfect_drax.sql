ALTER TABLE "entity" ADD COLUMN "country_id" bigint;
DO $$ BEGIN
 ALTER TABLE "entity" ADD CONSTRAINT "entity_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
