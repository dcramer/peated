ALTER TABLE "tasting" ADD COLUMN "toasts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "tasting" SET "toasts" = (SELECT COUNT(*) FROM "toasts" WHERE "toasts"."tasting_id" = "tasting"."id");
