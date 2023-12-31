UPDATE store_price SET bottle_id = (SELECT bottle_id FROM bottle_alias WHERE name = store_price.name) WHERE bottle_id IS NULL;

UPDATE review SET bottle_id = (SELECT bottle_id FROM bottle_alias WHERE name = review.name) WHERE bottle_id IS NULL;
