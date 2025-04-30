CREATE TABLE IF NOT EXISTS "entity_alias" (
	"entity_id" bigint,
	"name" varchar(255) NOT NULL,
	CONSTRAINT "entity_alias_name_pk" PRIMARY KEY("name")
);

CREATE INDEX IF NOT EXISTS "entity_alias_entity_idx" ON "entity_alias" ("entity_id");
DO $$ BEGIN
 ALTER TABLE "entity_alias" ADD CONSTRAINT "entity_alias_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

INSERT INTO "entity_alias" ("entity_id", "name")
  SELECT "entity"."id" as "entity_id", "entity"."name" as "name"
  FROM "entity"
  ON CONFLICT ("name") DO NOTHING;
