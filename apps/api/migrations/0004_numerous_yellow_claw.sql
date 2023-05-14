CREATE TABLE IF NOT EXISTS "toasts" (
	"tasting_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "toasts" ADD CONSTRAINT "toasts_tasting_id_created_by_id" PRIMARY KEY("tasting_id","created_by_id");

DO $$ BEGIN
 ALTER TABLE "toasts" ADD CONSTRAINT "toasts_tasting_id_tasting_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "tasting"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "toasts" ADD CONSTRAINT "toasts_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
