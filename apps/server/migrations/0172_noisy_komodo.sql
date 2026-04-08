ALTER TABLE "review" ADD COLUMN "release_id" bigint;
ALTER TABLE "review" ADD CONSTRAINT "review_release_id_bottle_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."bottle_release"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "review_release_idx" ON "review" USING btree ("release_id");