CREATE TABLE "bottle_note_category" (
	"bottle_id" bigint NOT NULL,
	"category" "tag_category" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bottle_note_category_bottle_id_category_pk" PRIMARY KEY("bottle_id","category")
);

ALTER TABLE "bottle_group" ADD COLUMN "public_review_and_tasting_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle_group" ADD COLUMN "noted_review_and_tasting_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "public_review_and_tasting_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle" ADD COLUMN "noted_review_and_tasting_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "entity" ADD COLUMN "public_review_and_tasting_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "bottle_note_category" ADD CONSTRAINT "bottle_note_category_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_note_category_category_idx" ON "bottle_note_category" USING btree ("category");
CREATE INDEX "bottle_tag_tag_idx" ON "bottle_tag" USING btree ("tag");
CREATE INDEX "bottle_public_activity_count_idx" ON "bottle" USING btree ("public_review_and_tasting_count");
CREATE INDEX "entity_public_activity_count_idx" ON "entity" USING btree ("public_review_and_tasting_count");