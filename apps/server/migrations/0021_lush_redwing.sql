ALTER TABLE "bottle" ADD COLUMN "bottler_id" bigint;
DO $$ BEGIN
 ALTER TABLE "bottle" ADD CONSTRAINT "bottle_bottler_id_entity_id_fk" FOREIGN KEY ("bottler_id") REFERENCES "entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
