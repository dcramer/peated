INSERT INTO "actor" (
	"type",
	"key",
	"display_name",
	"user_id",
	"picture_url",
	"active"
)
VALUES (
	'system'::"actor_type",
	'peated',
	'Peated',
	NULL,
	NULL,
	true
)
ON CONFLICT ("type", "key") DO UPDATE SET
	"display_name" = EXCLUDED."display_name",
	"user_id" = NULL,
	"picture_url" = NULL,
	"active" = true;

UPDATE "entity"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "entity"."created_by_actor_id" IS NULL
	AND "entity"."created_by_id" IS NOT NULL
	AND "actor"."type" = 'user'::"actor_type"
	AND "actor"."key" = "entity"."created_by_id"::text;

UPDATE "bottle"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle"."created_by_actor_id" IS NULL
	AND "bottle"."created_by_id" IS NOT NULL
	AND "actor"."type" = 'user'::"actor_type"
	AND "actor"."key" = "bottle"."created_by_id"::text;

UPDATE "bottle_release"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_release"."created_by_actor_id" IS NULL
	AND "bottle_release"."created_by_id" IS NOT NULL
	AND "actor"."type" = 'user'::"actor_type"
	AND "actor"."key" = "bottle_release"."created_by_id"::text;

UPDATE "bottle_series"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_series"."created_by_actor_id" IS NULL
	AND "bottle_series"."created_by_id" IS NOT NULL
	AND "actor"."type" = 'user'::"actor_type"
	AND "actor"."key" = "bottle_series"."created_by_id"::text;

UPDATE "bottle_alias"
SET "assigned_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_alias"."assigned_by_actor_id" IS NULL
	AND "bottle_alias"."assigned_by_id" IS NOT NULL
	AND "actor"."type" = 'user'::"actor_type"
	AND "actor"."key" = "bottle_alias"."assigned_by_id"::text;

UPDATE "entity"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "entity"."created_by_actor_id" IS NULL
	AND "actor"."type" = 'system'::"actor_type"
	AND "actor"."key" = 'peated';

UPDATE "bottle"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle"."created_by_actor_id" IS NULL
	AND "actor"."type" = 'system'::"actor_type"
	AND "actor"."key" = 'peated';

UPDATE "bottle_release"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_release"."created_by_actor_id" IS NULL
	AND "actor"."type" = 'system'::"actor_type"
	AND "actor"."key" = 'peated';

UPDATE "bottle_series"
SET "created_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_series"."created_by_actor_id" IS NULL
	AND "actor"."type" = 'system'::"actor_type"
	AND "actor"."key" = 'peated';

UPDATE "bottle_alias"
SET "assigned_by_actor_id" = "actor"."id"
FROM "actor"
WHERE "bottle_alias"."assigned_by_actor_id" IS NULL
	AND "actor"."type" = 'system'::"actor_type"
	AND "actor"."key" = 'peated';
