ALTER TABLE "follow" ADD COLUMN "id" bigserial NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "follow_unq" ON "follow" ("from_user_id","to_user_id");
ALTER TABLE "follow" DROP CONSTRAINT "follow_from_user_id_to_user_id";
ALTER TABLE "follow" ADD PRIMARY KEY (id);
