ALTER TABLE "bottle_group" ADD COLUMN "rater_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "rater_count" bigint DEFAULT 0 NOT NULL;