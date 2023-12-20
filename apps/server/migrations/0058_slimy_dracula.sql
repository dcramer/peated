ALTER TABLE "bottle" RENAME COLUMN "config" TO "tasting_notes";
ALTER TABLE "bottle" ADD COLUMN "suggested_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;