CREATE TABLE IF NOT EXISTS "bottle_alias" (
	"bottle_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	CONSTRAINT bottle_alias_bottle_id_full_name PRIMARY KEY("bottle_id","name")
);

DO $$ BEGIN
 ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "bottle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
