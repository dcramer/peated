CREATE TYPE "public"."report_object_type" AS ENUM('tasting', 'member_review', 'comment', 'user');
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual_content', 'violence', 'other');
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');
CREATE TABLE "report" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"object_type" "report_object_type" NOT NULL,
	"object_id" bigint NOT NULL,
	"reported_user_id" bigint NOT NULL,
	"reason" "report_reason" NOT NULL,
	"comment" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_by_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_by_id" bigint,
	"closed_at" timestamp,
	"close_note" text,
	CONSTRAINT "report_close_state_check" CHECK ((
        "report"."status" = 'open'
        AND "report"."closed_at" IS NULL
      ) OR (
        "report"."status" <> 'open'
        AND "report"."closed_at" IS NOT NULL
      ))
);

CREATE TABLE "user_block" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"blocked_user_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user" ADD COLUMN "suspended_at" timestamp;
ALTER TABLE "user" ADD COLUMN "suspended_by_id" bigint;
ALTER TABLE "user" ADD COLUMN "suspension_reason" text;
ALTER TABLE "report" ADD CONSTRAINT "report_reported_user_id_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "report" ADD CONSTRAINT "report_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "report" ADD CONSTRAINT "report_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocked_user_id_user_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "report_open_unq" ON "report" USING btree ("created_by_id","object_type","object_id") WHERE "report"."status" = 'open';
CREATE INDEX "report_status_created_idx" ON "report" USING btree ("status","created_at","id");
CREATE INDEX "report_object_idx" ON "report" USING btree ("object_type","object_id");
CREATE INDEX "report_reported_user_idx" ON "report" USING btree ("reported_user_id");
CREATE UNIQUE INDEX "user_block_unq" ON "user_block" USING btree ("user_id","blocked_user_id");
CREATE INDEX "user_block_blocked_user_idx" ON "user_block" USING btree ("blocked_user_id");
ALTER TABLE "user" ADD CONSTRAINT "user_suspended_by_id_user_id_fk" FOREIGN KEY ("suspended_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user" ADD CONSTRAINT "user_suspension_state_check" CHECK ((
        "user"."suspended_at" IS NULL
        AND "user"."suspension_reason" IS NULL
      ) OR (
        "user"."suspended_at" IS NOT NULL
        AND NULLIF(BTRIM("user"."suspension_reason"), '') IS NOT NULL
      ));