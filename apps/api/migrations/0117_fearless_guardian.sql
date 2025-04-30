DROP INDEX "country_name_unq";
DROP INDEX "country_slug_unq";

CREATE UNIQUE INDEX "country_name_unq" ON "country" (LOWER("name"));
CREATE UNIQUE INDEX "country_slug_unq" ON "country" (LOWER("slug"));
