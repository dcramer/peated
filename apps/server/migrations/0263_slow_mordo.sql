ALTER TABLE "member_review" ADD COLUMN "tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;
ALTER TABLE "member_review" ADD COLUMN "color" integer;
ALTER TABLE "member_review" ADD COLUMN "serving_style" "servingStyle";
ALTER TABLE "member_review" ADD COLUMN "friends" bigint[] DEFAULT array[]::bigint[] NOT NULL;