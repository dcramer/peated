ALTER TABLE "incoming_bottle_decision_log" DROP CONSTRAINT "incoming_bottle_decision_log_bottle_id_bottle_id_fk";

ALTER TABLE "incoming_bottle_decision_log" ALTER COLUMN "bottle_id" DROP NOT NULL;
ALTER TABLE "incoming_bottle_decision_log" ADD CONSTRAINT "incoming_bottle_decision_log_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;