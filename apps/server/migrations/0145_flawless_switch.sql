ALTER TABLE "bottle_alias" ADD COLUMN "edition_id" bigint;
DO $$ BEGIN
 ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_edition_id_bottle_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."bottle_edition"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bottle_alias_edition_idx" ON "bottle_alias" USING btree ("edition_id");