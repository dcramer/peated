ALTER TABLE "bottle_tombstone" ADD COLUMN "new_bottle_group_id" bigint;
ALTER TABLE "bottle_tombstone" ADD CONSTRAINT "bottle_tombstone_new_bottle_group_id_bottle_group_id_fk" FOREIGN KEY ("new_bottle_group_id") REFERENCES "public"."bottle_group"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "bottle_tombstone_new_group_idx" ON "bottle_tombstone" USING btree ("new_bottle_group_id");
ALTER TABLE "bottle_tombstone" ADD CONSTRAINT "bottle_tombstone_destination_check" CHECK (NOT ("bottle_tombstone"."new_bottle_id" IS NOT NULL AND "bottle_tombstone"."new_bottle_group_id" IS NOT NULL));