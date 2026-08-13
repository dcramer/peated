UPDATE "bottle_check"
SET
	"closed_at" = NOW(),
	"close_reason" = 'dismissed',
	"close_note" = 'Automatically closed after the Bottle Check schema version 2 cutover.'
WHERE
	"schema_version" = 1
	AND "closed_at" IS NULL;
