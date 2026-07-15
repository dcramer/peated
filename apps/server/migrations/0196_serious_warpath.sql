ALTER TYPE "public"."object_type" ADD VALUE 'bottle_group' BEFORE 'bottle_release';
ALTER TABLE "catalog_target" DROP CONSTRAINT "catalog_target_bottle_membership_fk";

ALTER TABLE "catalog_target" ADD CONSTRAINT "catalog_target_bottle_membership_fk" FOREIGN KEY ("bottle_id","bottle_group_id") REFERENCES "public"."bottle"("id","group_id") ON DELETE no action ON UPDATE cascade;