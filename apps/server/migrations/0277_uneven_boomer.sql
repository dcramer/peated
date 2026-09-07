ALTER TABLE "member_review" ADD COLUMN "nose_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;
ALTER TABLE "member_review" ADD COLUMN "palate_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;
ALTER TABLE "member_review" ADD COLUMN "finish_tags" varchar(64)[] DEFAULT array[]::varchar[] NOT NULL;