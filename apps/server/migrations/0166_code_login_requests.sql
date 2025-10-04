-- Create table for email code-based login requests
CREATE TABLE IF NOT EXISTS "login_request" (
  "id" bigserial PRIMARY KEY,
  "request_id" text NOT NULL,
  "user_id" bigint NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_request_request_id_unq" ON "login_request" ("request_id");
CREATE INDEX IF NOT EXISTS "login_request_user_id_idx" ON "login_request" ("user_id");

