ALTER TABLE "bottle" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "entity" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;