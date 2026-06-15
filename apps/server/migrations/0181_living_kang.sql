CREATE TYPE "public"."bottle_alias_assignment_source" AS ENUM('legacy', 'canonical', 'source_approved', 'classifier_approved', 'human_approved', 'generated');
ALTER TABLE "bottle_alias" ADD COLUMN "assignment_source" "bottle_alias_assignment_source" DEFAULT 'legacy' NOT NULL;
ALTER TABLE "bottle_alias" ADD COLUMN "assignment_trusted" boolean DEFAULT true NOT NULL;
ALTER TABLE "bottle_alias" ADD COLUMN "assigned_by_id" bigint;
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;