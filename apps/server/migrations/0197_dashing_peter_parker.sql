DROP INDEX "bottle_release_promotion_bottle_unq";
CREATE INDEX "bottle_release_promotion_bottle_idx" ON "bottle_release_promotion" USING btree ("promoted_bottle_id");