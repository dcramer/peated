ALTER TABLE "bottle_alias" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "entity_alias" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;