ALTER TABLE "review" DROP CONSTRAINT "review_external_site_id_external_site_id_fk";

DROP INDEX "review_unq_name";
DROP INDEX "review_legacy_site_url_unq";
ALTER TABLE "review" ALTER COLUMN "article_id" SET NOT NULL;
ALTER TABLE "review" DROP COLUMN "external_site_id";
ALTER TABLE "review" DROP COLUMN "issue";
ALTER TABLE "review" DROP COLUMN "url";