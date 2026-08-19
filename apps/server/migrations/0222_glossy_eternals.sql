ALTER TABLE "review_article" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "review_article" ALTER COLUMN "content_hash" DROP NOT NULL;
ALTER TABLE "review_article" ALTER COLUMN "fetched_at" DROP NOT NULL;
--> statement-breakpoint

INSERT INTO "review_article" ("external_site_id", "canonical_url", "issue")
SELECT "external_site_id", "url", "issue"
FROM "review"
WHERE "article_id" IS NULL
ON CONFLICT ("external_site_id", "canonical_url") DO NOTHING;

UPDATE "review"
SET "article_id" = "review_article"."id"
FROM "review_article"
WHERE "review"."article_id" IS NULL
	AND "review_article"."external_site_id" = "review"."external_site_id"
	AND "review_article"."canonical_url" = "review"."url";

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "review"
		LEFT JOIN "review_article" ON "review_article"."id" = "review"."article_id"
		WHERE "review_article"."id" IS NULL
			OR "review_article"."external_site_id" IS DISTINCT FROM "review"."external_site_id"
			OR "review_article"."canonical_url" IS DISTINCT FROM "review"."url"
	) THEN
		RAISE EXCEPTION 'Review article backfill left an unlinked or mismatched review';
	END IF;
END $$;
