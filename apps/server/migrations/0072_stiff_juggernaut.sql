CREATE TABLE IF NOT EXISTS "external_site_config" (
	"external_site_id" bigint NOT NULL,
	"key" varchar(255) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_site_config_external_site_id_key_pk" PRIMARY KEY("external_site_id","key")
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_unq_name" ON "review" ("external_site_id","name","issue");
DO $$ BEGIN
 ALTER TABLE "external_site_config" ADD CONSTRAINT "external_site_config_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "external_site"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
