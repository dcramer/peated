CREATE TABLE IF NOT EXISTS "entity_tombstone" (
	"entity_id" bigint PRIMARY KEY NOT NULL,
	"new_entity_id" bigint
);
