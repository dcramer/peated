DROP INDEX IF EXISTS "user_email_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unq" ON "user" USING btree (LOWER("email"));
DROP INDEX IF EXISTS "user_username_unq";
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unq" ON "user" USING btree (LOWER("username"));
