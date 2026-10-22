CREATE TABLE "wrong_photo_match" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_by_id" bigint NOT NULL,
	"pending_upload_id" text NOT NULL,
	"image_url" text,
	"image_evidence" jsonb NOT NULL,
	"wrong_bottle_id" bigint,
	"correct_bottle_id" bigint,
	"trace_id" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "wrong_photo_match" ADD CONSTRAINT "wrong_photo_match_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wrong_photo_match" ADD CONSTRAINT "wrong_photo_match_wrong_bottle_id_bottle_id_fk" FOREIGN KEY ("wrong_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "wrong_photo_match" ADD CONSTRAINT "wrong_photo_match_correct_bottle_id_bottle_id_fk" FOREIGN KEY ("correct_bottle_id") REFERENCES "public"."bottle"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "wrong_photo_match_pending_upload_unq" ON "wrong_photo_match" USING btree ("created_by_id","pending_upload_id");
CREATE INDEX "wrong_photo_match_created_at_idx" ON "wrong_photo_match" USING btree ("created_at");
CREATE INDEX "wrong_photo_match_wrong_bottle_idx" ON "wrong_photo_match" USING btree ("wrong_bottle_id");
CREATE INDEX "wrong_photo_match_correct_bottle_idx" ON "wrong_photo_match" USING btree ("correct_bottle_id");