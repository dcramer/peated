CREATE TABLE "review_article" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"issue" text,
	"published_at" timestamp,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "review" DROP CONSTRAINT "review_url_unique";
ALTER TABLE "review" ALTER COLUMN "rating" DROP NOT NULL;
ALTER TABLE "review" ADD COLUMN "article_id" bigint;
ALTER TABLE "review" ADD COLUMN "source_key" text;
ALTER TABLE "review" ADD COLUMN "reviewer_name" text;
ALTER TABLE "review" ADD COLUMN "native_score_value" double precision;
ALTER TABLE "review" ADD COLUMN "native_score_scale" double precision;
ALTER TABLE "review" ADD COLUMN "native_score_display" text;
ALTER TABLE "review" ADD COLUMN "summary" text;
ALTER TABLE "review" ADD COLUMN "summary_content_hash" text;
ALTER TABLE "review" ADD COLUMN "summary_model" text;
ALTER TABLE "review" ADD COLUMN "summary_prompt_version" text;
ALTER TABLE "review" ADD COLUMN "summary_generated_at" timestamp;
ALTER TABLE "review_article" ADD CONSTRAINT "review_article_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "review_article_site_url_unq" ON "review_article" USING btree ("external_site_id","canonical_url");
ALTER TABLE "review" ADD CONSTRAINT "review_article_id_review_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."review_article"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "review_article_source_key_unq" ON "review" USING btree ("article_id","source_key");
CREATE INDEX "review_article_idx" ON "review" USING btree ("article_id");
ALTER TABLE "review" ADD CONSTRAINT "review_rating_check" CHECK ("review"."rating" IS NULL OR "review"."rating" BETWEEN 0 AND 100);
ALTER TABLE "review" ADD CONSTRAINT "review_native_score_check" CHECK ((
        "review"."native_score_value" IS NULL
        AND "review"."native_score_scale" IS NULL
        AND "review"."native_score_display" IS NULL
      ) OR (
        "review"."native_score_value" IS NOT NULL
        AND "review"."native_score_scale" IS NOT NULL
        AND "review"."native_score_display" IS NOT NULL
        AND "review"."native_score_value" >= 0
        AND "review"."native_score_scale" > 0
        AND "review"."native_score_value" <= "review"."native_score_scale"
      ));
ALTER TABLE "review" ADD CONSTRAINT "review_summary_provenance_check" CHECK ((
        "review"."summary" IS NULL
        AND "review"."summary_content_hash" IS NULL
        AND "review"."summary_model" IS NULL
        AND "review"."summary_prompt_version" IS NULL
        AND "review"."summary_generated_at" IS NULL
      ) OR (
        "review"."summary" IS NOT NULL
        AND "review"."summary_content_hash" IS NOT NULL
        AND "review"."summary_model" IS NOT NULL
        AND "review"."summary_prompt_version" IS NOT NULL
        AND "review"."summary_generated_at" IS NOT NULL
      ));