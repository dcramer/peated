CREATE TABLE "review_body" (
	"review_id" bigint PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"fetched_at" timestamp NOT NULL
);

ALTER TABLE "review" ADD COLUMN "tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;
ALTER TABLE "review_body" ADD CONSTRAINT "review_body_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;