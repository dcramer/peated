INSERT INTO bottle_alias (name, bottle_id)
SELECT DISTINCT ON (name) name, bottle_id
FROM store_price
ON CONFLICT (name) DO UPDATE
SET bottle_id = bottle_alias.bottle_id
WHERE bottle_alias.bottle_id IS NULL;

INSERT INTO bottle_alias (name, bottle_id)
SELECT DISTINCT ON (name) name, bottle_id
FROM review
ON CONFLICT (name) DO UPDATE
SET bottle_id = bottle_alias.bottle_id
WHERE bottle_alias.bottle_id IS NULL;

UPDATE bottle_alias
SET bottle_id = (
    SELECT id FROM bottle WHERE full_name = bottle_alias.name
)
WHERE bottle_id IS NULL;

UPDATE store_price SET bottle_id = (SELECT bottle_id FROM bottle_alias WHERE name = store_price.name) WHERE bottle_id IS NULL;

UPDATE review SET bottle_id = (SELECT bottle_id FROM bottle_alias WHERE name = review.name) WHERE bottle_id IS NULL;
