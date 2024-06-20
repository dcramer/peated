CREATE TABLE IF NOT EXISTS "country" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"location" "geography"
);

CREATE UNIQUE INDEX IF NOT EXISTS "country_name_unq" ON "country" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "country_slug_unq" ON "country" ("slug");
