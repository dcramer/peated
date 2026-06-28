CREATE TYPE "public"."pendingUploadKind" AS ENUM('image');
CREATE TYPE "public"."pendingUploadPurpose" AS ENUM('photo_tasting_entry', 'tasting_image', 'bottle_image', 'bottle_release_image', 'badge_image', 'avatar');
CREATE TYPE "public"."pendingUploadStatus" AS ENUM('pending', 'attached', 'expired');
CREATE TABLE "pending_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by_id" bigint NOT NULL,
	"image_url" text NOT NULL,
	"namespace" varchar(64) NOT NULL,
	"kind" "pendingUploadKind" NOT NULL,
	"purpose" "pendingUploadPurpose" NOT NULL,
	"status" "pendingUploadStatus" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(128),
	"attached_to_type" varchar(64),
	"attached_to_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "pending_upload_idempotency_key" UNIQUE("created_by_id","purpose","idempotency_key")
);

ALTER TABLE "pending_upload" ADD CONSTRAINT "pending_upload_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "pending_upload_created_by_idx" ON "pending_upload" USING btree ("created_by_id");
CREATE INDEX "pending_upload_status_expires_at_idx" ON "pending_upload" USING btree ("status","expires_at");