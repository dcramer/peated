DO $$ BEGIN
 CREATE TYPE "follow_status" AS ENUM('none', 'pending', 'following');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "follow" (
	"from_user_id" bigint NOT NULL,
	"to_user_id" bigint NOT NULL,
	"status" follow_status DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_from_user_id_to_user_id" PRIMARY KEY("from_user_id","to_user_id");

DO $$ BEGIN
 ALTER TABLE "follow" ADD CONSTRAINT "follow_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow" ADD CONSTRAINT "follow_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
